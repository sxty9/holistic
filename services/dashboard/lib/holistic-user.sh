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

# Create the Linux account + storage + group membership. $2 = display name (GECOS, optional).
holistic_user_create_account() {
    local name="$1" gecos="${2:-}"
    local args=(-m -d "$HOLISTIC_USERS_ROOT/$name" -s /usr/sbin/nologin -U)
    [[ -n "$gecos" ]] && args+=(-c "$gecos")
    useradd "${args[@]}" "$name"
    usermod -aG "$HOLISTIC_GROUPS" "$name"
    chown "$name:$name" "$HOLISTIC_USERS_ROOT/$name"
    chmod 0700 "$HOLISTIC_USERS_ROOT/$name"
}

# Set the Linux password (cleartext on stdin -> chpasswd; never in argv).
holistic_set_linux_password() {
    printf '%s:%s' "$1" "$2" | chpasswd
}

# Add a NEW Samba user with this password and enable it.
holistic_set_smb_password_new() {
    printf '%s\n%s\n' "$2" "$2" | smbpasswd -s -a "$1"
    smbpasswd -e "$1"
}

# Change an EXISTING Samba user's password.
holistic_set_smb_password_change() {
    printf '%s\n%s\n' "$2" "$2" | smbpasswd -s "$1"
}

# Set BOTH passwords for an existing user (the sanctioned bidirectional path).
holistic_set_password() {
    holistic_set_linux_password "$1" "$2"
    holistic_set_smb_password_change "$1" "$2"
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
