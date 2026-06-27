import type { ComponentType, ReactNode } from 'react';

/** Identity of the logged-in Linux/Samba user, provided by the shell. */
export interface HolisticUser {
  username: string; // Linux account name (== Samba user)
  displayName: string; // human label for the top bar (nickname, else OS name)
  groups: string[]; // e.g. ["family","smbusers"]
  isAdmin: boolean; // member of the admin group (Linux sudo — single source of truth)
  // Whether the user's login shell is a real shell (not nologin/false) — the source of truth
  // for the shell-type right (remshel). Optional so older payloads keep working.
  shellEnabled?: boolean;
  // App-managed profile fields (editable via the account menu). Optional so older
  // payloads and services that don't care keep working unchanged.
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null; // profile photo, or null/undefined for initials
}

/** A service-scoped, already-authenticated API client. Base URL is
 *  /api/services/<id>/ ; cookies + CSRF are handled by the shell.
 *  Services never construct their own fetch/axios. */
export interface ServiceApiClient {
  get<T>(path: string, init?: RequestInit): Promise<T>;
  post<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  put<T>(path: string, body?: unknown, init?: RequestInit): Promise<T>;
  del<T>(path: string, init?: RequestInit): Promise<T>;
  /** Raw Response, for binary download / multipart upload. */
  raw(path: string, init?: RequestInit): Promise<Response>;
  /** Absolute URL for <img>/<video> src used by SDK viewers (never a raw <img> in a service). */
  url(path: string): string;
}

/** Navigation scoped to this service's sub-route (/app/<id>/...). */
export interface ServiceNavigation {
  path: string; // current sub-path within the service
  navigate(subPath: string): void; // push within the service
  setTitle(title: string | null): void; // updates the TopBar title segment
}

/** Imperative SDK surfaces the shell owns. */
export interface ServiceUiBridge {
  toast(opts: { title: string; description?: ReactNode; variant?: 'info' | 'success' | 'error' }): void;
  confirm(opts: { title: string; description?: ReactNode; danger?: boolean; confirmLabel?: string }): Promise<boolean>;
}

/** Which domain this holistic instance is currently served on, resolved at runtime so the
 *  app is portable across deployments (any operator, any domain, zero hardcoding).
 *  `mailDomain` is the stable, canonical domain for addresses like `user@<mailDomain>` —
 *  empty until a public domain has been observed (then a service should prompt the operator
 *  to set HOLISTIC_MAIL_DOMAIN). Source of truth: GET /api/instance. */
export interface InstanceInfo {
  origin: string; // e.g. "https://example.com"
  host: string; // e.g. "example.com"
  mailDomain: string; // canonical mail domain, or "" if none detected yet
}

/** Props the shell passes to every service's root Component. */
export interface ServiceContextProps {
  user: HolisticUser;
  api: ServiceApiClient;
  nav: ServiceNavigation;
  ui: ServiceUiBridge;
  instance: InstanceInfo; // runtime domain — single source of truth for services
}

/** THE CONTRACT: services/<name>/ui/index.tsx default-exports this object. */
export interface ServicePlugin {
  /** Stable id; MUST equal the service directory name (== manifest entry). */
  id: string;
  /** Label rendered in the sidebar + top bar. */
  displayName: string;
  /** Sidebar icon — an SDK component (never raw svg in a service). */
  icon: ComponentType<{ className?: string }>;
  /** The mounted root. Receives ServiceContextProps; renders ONLY @holistic/ui. */
  Component: ComponentType<ServiceContextProps>;
  /** Optional visibility gate. When OMITTED the shell applies the default rights gate
   *  (`serviceVisibleByDefault`): the tab is shown only to admins or users holding at least
   *  one of the service's `hp_<id>_*` rights — so a service the user has no rights for never
   *  clutters the sidebar. Define this only for services whose access right doesn't follow
   *  the `hp_<id>_*` convention (e.g. privleg's `hp_priv_*`, or remshel's shell-type right). */
  visible?(user: HolisticUser): boolean;
  /** Optional sidebar ordering hint; lower = higher. Default 100. */
  order?: number;
}

/** Which standardized viewer renders a file (resolved server-side from sniffed MIME). */
export type ViewerKind = 'image' | 'text' | 'markdown' | 'audio' | 'video' | 'pdf';

/** A file/folder entry — the shared shape across the SDK, the Samba UI, and the backend JSON. */
export interface FileEntry {
  name: string;
  path: string; // virtual path, e.g. "me/Photos/a.jpg"
  kind: 'file' | 'dir';
  size: number; // bytes (0 for dirs)
  mtime: number; // epoch ms
  mime?: string | null;
  viewer?: ViewerKind | null;
  permissions?: string; // e.g. "rwx------"
}

/** A storage root surfaced as a top-level location. */
export interface FileRoot {
  key: string; // "me" | "family"
  label: string; // "My Drive" | "Family"
  writable: boolean;
}

export interface FileActionContext {
  entries: FileEntry[];
}

/* ────────────────────────────── Rights standard ──────────────────────────────
 * The holistic-wide way a service declares which fine-grained rights it offers
 * for NON-admin users. Each right is backed 1:1 by a Linux group; granting a
 * right = adding the user to that group. Admins (sudo) implicitly have every
 * right and are never listed here. A service drops its manifest at install time
 * to /etc/holistic/permissions.d/<service>.json; the `privleg` service
 * aggregates all manifests to render the rights editor.
 *
 * Enforcement everywhere is uniform:
 *     userHasRight(user, perm) = user.isAdmin || perm.group ∈ user.groups
 * `default` only controls INITIAL group membership (see PermissionDecl.default), so a
 * host WITHOUT privleg behaves exactly as before: default:false rights are admin-only
 * (empty group) and default:true rights stay granted to everyone (provisioning grants
 * them). privleg later grants default:false rights and revokes default:true ones.
 */

/** A single fine-grained right a service exposes to non-admin users. */
export interface PermissionDecl {
  /** Service-local, stable id. Fully-qualified form: `<service>:<category>:<id>`. */
  id: string;
  /** Human label shown in the rights editor. */
  label: string;
  /** Optional longer explanation of what the right unlocks. */
  description?: string;
  /** Permission kind. 'group' (default): a fine-grained right backed 1:1 by a Linux
   *  group. 'shell': an EXCEPTION to the group model — the right IS the user's Linux
   *  login shell (the single source of truth for "shell-entitled"), which privleg reads
   *  via getent and writes via usermod. A 'shell' permission has no backing group. */
  type?: 'group' | 'shell';
  /** Linux group backing this right — the authority for storage AND enforcement. Required
   *  for 'group' permissions, omitted for 'shell'. MUST be `hp_`-prefixed and match
   *  /^hp_[a-z0-9][a-z0-9_-]{0,27}$/ (<=31 chars). The mandatory prefix is a security
   *  boundary: privleg only ever toggles hp_* groups, so it can never be tricked into
   *  touching sudo/family/smbusers. */
  group?: string;
  /** For a 'shell' permission: the login shell set when the right is granted (default
   *  /bin/bash). Revoking sets the user's shell to nologin. */
  shell?: string;
  /** Baseline membership for non-admins (enforcement is the same either way):
   *  - false / omitted: the group starts empty; privleg GRANTS the right per user.
   *  - true: provisioning auto-adds every user to the group, so the right is on by
   *    default (prior behaviour); privleg REVOKES it per user. */
  default?: boolean;
  /** UI hint: require an explicit confirm before granting (e.g. power, delete). */
  dangerous?: boolean;
  /** UI hint: the right exposes sensitive data (e.g. identifiers, serials). Purely a
   *  label — flags information sensitivity, the counterpart to `dangerous`'s action risk. */
  sensitive?: boolean;
}

/** A sensible grouping of related rights within one service. */
export interface PermissionCategory {
  id: string;
  label: string;
  description?: string;
  permissions: PermissionDecl[];
}

/** What a service declares to the holistic rights standard.
 *  Dropped to /etc/holistic/permissions.d/<service>.json at install time. */
export interface PermissionManifest {
  /** MUST equal the ServicePlugin id (== service directory name). */
  service: string;
  /** Bumped whenever the declared rights change. */
  version: number;
  categories: PermissionCategory[];
}

/** Additive enforcement rule, shared by every service UI and the privleg editor.
 *  A host without privleg has empty `hp_*` groups, so non-admins resolve to
 *  admin-only — identical to pre-rights-standard behaviour. */
export function userHasRight(user: Pick<HolisticUser, 'isAdmin' | 'groups'>, group: string): boolean {
  return user.isAdmin || user.groups.includes(group);
}

/** Default sidebar-visibility gate for a service that doesn't define its own `visible`:
 *  a tab is shown only to admins, or to users holding at least one of the service's rights.
 *  By the rights-standard convention a service's backing groups are `hp_<id>_*`, so holding
 *  any such group means "has a right for this service". A service the user has no rights for
 *  is hidden — no empty, unusable tab. (Services whose rights don't follow the convention —
 *  privleg's `hp_priv_*`, remshel's shell-type right — supply their own `visible` instead.) */
export function serviceVisibleByDefault(user: Pick<HolisticUser, 'isAdmin' | 'groups'>, serviceId: string): boolean {
  return user.isAdmin || user.groups.some((g) => g.startsWith(`hp_${serviceId}_`));
}
