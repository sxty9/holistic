# holistic-user.sh — single source of truth for Linux+Samba user provisioning.
#
# Sourced by the `holistic` CLI AND by every privileged wrapper in /usr/local/sbin,
# so the CLI and the dashboard backend produce byte-identical effects.
#
# Conventions:
#   - No `set -e` here; callers own their error mode. Functions return non-zero on failure.
#   - Passwords are passed as a positional arg from callers that already read them off
#     stdin. They are only ever fed to chpasswd/smbpasswd via a pipe (printf builtin),
#     never via an external process's argv, and never echoed or logged.

HOLISTIC_USERS_ROOT="${HOLISTIC_USERS_ROOT:-/srv/storage/users}"
HOLISTIC_GROUPS="${HOLISTIC_GROUPS:-family,smbusers}"
# Admin status is the Linux sudo group (single source of truth), granted by the OS —
# not provisioned here, so this lib no longer manages an admin group.

# 0 if the Linux account exists.
holistic_user_exists() {
    id "$1" &>/dev/null
}

# Add a user to every `default: true` rights group declared under permissions.d, so a
# host without privleg keeps prior behaviour (the right is on until an admin revokes it).
# Best-effort + idempotent; no-op if no service declares default-on rights.
holistic_user_grant_defaults() {
    local name="$1" perms_tool g sh cur
    perms_tool="$(dirname "${BASH_SOURCE[0]}")/holistic-perms.py"
    [[ -f "$perms_tool" ]] || return 0
    while read -r g; do
        [[ -n "$g" ]] || continue
        groupadd -f "$g" 2>/dev/null || true
        gpasswd -a "$name" "$g" >/dev/null 2>&1 || true
    done < <(python3 "$perms_tool" default-groups 2>/dev/null || true)
    # Default-on shell access (e.g. remshel): set the default login shell, but only if the
    # user currently has a disabling shell (nologin/false) — never clobber a real one. The
    # login shell is the single source of truth, the exception to the group-based model.
    cur="$(getent passwd "$name" | cut -d: -f7)"
    case "$cur" in
        */nologin | */false | "")
            sh="$(python3 "$perms_tool" default-shells 2>/dev/null | head -n1 || true)"
            [[ -n "$sh" && -x "$sh" ]] && usermod -s "$sh" "$name" 2>/dev/null || true
            ;;
    esac
}

# Create the Linux account + storage + group membership. $2 = display name (GECOS, optional).
holistic_user_create_account() {
    local name="$1" gecos="${2:-}"
    local args=(-m -d "$HOLISTIC_USERS_ROOT/$name" -s /usr/sbin/nologin -U)
    [[ -n "$gecos" ]] && args+=(-c "$gecos")
    useradd "${args[@]}" "$name"
    usermod -aG "$HOLISTIC_GROUPS" "$name"
    holistic_user_grant_defaults "$name"
    chown "$name:$name" "$HOLISTIC_USERS_ROOT/$name"
    chmod 0700 "$HOLISTIC_USERS_ROOT/$name"
}

# Onboard an EXISTING Linux user into holistic: add the holistic group memberships +
# create the private storage drive. Does NOT run useradd and never touches the user's
# login password or /home. Idempotent.
holistic_user_adopt() {
    local name="$1"
    usermod -aG "$HOLISTIC_GROUPS" "$name"
    holistic_user_grant_defaults "$name"
    mkdir -p "$HOLISTIC_USERS_ROOT/$name"
    chown "$name:" "$HOLISTIC_USERS_ROOT/$name"   # group = the user's login group
    chmod 0700 "$HOLISTIC_USERS_ROOT/$name"
}

# Reverse of adopt: drop the holistic group memberships + remove the Samba entry. Leaves the
# Linux account, /home, and the storage drive intact. Uses `gpasswd -d` per group (NOT
# `usermod -G`, which would clobber the user's other groups). Idempotent.
holistic_user_unadopt() {
    local name="$1" g
    for g in ${HOLISTIC_GROUPS//,/ }; do
        gpasswd -d "$name" "$g" 2>/dev/null || true
    done
    smbpasswd -x "$name" 2>/dev/null || true
}

# THE single credential setter — the ONLY sanctioned way to set a password anywhere in
# holistic. Writes the Linux password AND the Samba password together, so the two can never
# diverge: one account, one password, everywhere (strict single source of truth). Creates the
# Samba entry if it's missing, otherwise updates it. Cleartext only ever reaches
# chpasswd/smbpasswd via a pipe (printf builtin), never via argv, and is never logged.
holistic_set_password() {
    local name="$1" pw="$2"
    printf '%s:%s' "$name" "$pw" | chpasswd
    if pdbedit -L 2>/dev/null | cut -d: -f1 | grep -qxF "$name"; then
        printf '%s\n%s\n' "$pw" "$pw" | smbpasswd -s "$name"
    else
        printf '%s\n%s\n' "$pw" "$pw" | smbpasswd -s -a "$name"
        smbpasswd -e "$name"
    fi
}

# Remove the user from Samba + Linux. $2 = "--purge" also deletes the home tree.
holistic_user_delete() {
    smbpasswd -x "$1" 2>/dev/null || true
    if [[ "${2:-}" == "--purge" ]]; then
        userdel -r "$1"
    else
        userdel "$1"
    fi
}
