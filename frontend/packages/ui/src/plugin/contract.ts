import type { ComponentType, ReactNode } from 'react';

/** Identity of the logged-in Linux/Samba user, provided by the shell. */
export interface HolisticUser {
  username: string; // Linux account name (== Samba user)
  displayName: string; // human label for the top bar
  groups: string[]; // e.g. ["family","smbusers"]
  isAdmin: boolean; // member of holistic-admins
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

/** Props the shell passes to every service's root Component. */
export interface ServiceContextProps {
  user: HolisticUser;
  api: ServiceApiClient;
  nav: ServiceNavigation;
  ui: ServiceUiBridge;
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
  /** Optional visibility gate (e.g. require a group). Default: always visible. */
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
