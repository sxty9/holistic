import type { ComponentType } from 'react';
import type { FileEntry, HolisticUser, ServiceApiClient, ServiceUiBridge } from '../plugin/contract';

/** Context handed to a folder action's panel when the user opens it from the Files toolbar.
 *  The action runs INSIDE the Files app, so `api` is the Files service's own client (read the
 *  current folder via fs/*), while `apiFor` reaches the contributing service's backend (e.g.
 *  aigentic's /run). The Files/Samba code stays generic — it never imports the action. */
export interface FolderActionContext {
  /** Current folder as a virtual path, e.g. "me/Notes". */
  cwd: string;
  /** Entries in the current folder. */
  entries: FileEntry[];
  /** The user's current selection (may be empty → operate on the whole folder). */
  selection: FileEntry[];
  /** The Files app's API client — read file contents via fs/text, fs/list, … */
  api: ServiceApiClient;
  /** A client for any sibling service, to call the contributing service's backend. */
  apiFor: (serviceId: string) => ServiceApiClient;
  ui: ServiceUiBridge;
  user: HolisticUser;
  /** Switch the dashboard to another service's tab (cross-service handoff — e.g. "continue
   *  this answer in the aigentic chat"). Pass bulky payloads out-of-band, not in subPath. */
  openService: (serviceId: string, subPath?: string) => void;
  /** Close the action panel. */
  close: () => void;
}

/** A folder-level action a service contributes to the shared Files toolbar (e.g. aigentic's
 *  "Ask AI"). Registered at module load via {@link registerFolderAction}; the Files app renders
 *  a button per visible action and mounts its Panel when clicked. This keeps the feature owned
 *  by the contributing service — the Files/Samba code knows nothing about any specific action. */
export interface FolderAction {
  /** Stable id, namespaced by the contributing service (e.g. "aigentic.ask"). */
  id: string;
  /** Toolbar button label. */
  label: string;
  /** Toolbar button icon. */
  icon?: ComponentType<{ className?: string }>;
  /** Visibility gate (e.g. only users holding the service's run right); omitted → always. */
  visible?: (user: HolisticUser) => boolean;
  /** The panel rendered when the action is opened; owns its own UX + network calls. */
  Panel: ComponentType<FolderActionContext>;
}

const registry: FolderAction[] = [];

/** Register a folder action. Idempotent by id (safe across hot reloads / repeated imports). */
export function registerFolderAction(action: FolderAction): void {
  const i = registry.findIndex((a) => a.id === action.id);
  if (i >= 0) registry[i] = action;
  else registry.push(action);
}

/** All registered folder actions, in registration order. The Files app filters by visibility. */
export function folderActions(): readonly FolderAction[] {
  return registry;
}
