import type { ComponentType } from 'react';
import type { FileEntry, SessionUser, ServiceApiClient, ServiceUiBridge } from '../plugin/contract';
import type { TextPayload } from './viewers';
import { createActionRegistry } from './actionRegistry';

/** Bridges + content accessors a FilePreview host hands down so registered viewer actions can run
 *  against the CURRENTLY shown file. Content is host-specific: the Files app reads it from its
 *  fileshare, Mail reads an attachment from the message — so the host, which already loaded the
 *  file to preview it, provides the text (via {@link FilePreviewProps.text}) and a raw-bytes
 *  loader. The action reaches its own backend through `apiFor`. */
export interface FileViewerActionHost {
  /** A client for any sibling service, to call the contributing service's backend (e.g. aigentic). */
  apiFor: (serviceId: string) => ServiceApiClient;
  ui: ServiceUiBridge;
  user: SessionUser;
  /** Switch the dashboard to another service's tab (cross-service handoff). */
  openService: (serviceId: string, subPath?: string) => void;
  /** Fetch the raw bytes of the file currently shown in the viewer (host-authenticated). Used for
   *  binary types (image/pdf). Omit when the host can't supply bytes — such files are then
   *  unreadable and the action gets no bytes. Text rides in the preview's `text` payload instead. */
  loadBytes?: () => Promise<Uint8Array>;
}

/** Context handed to a viewer action's panel — the one displayed file plus the host's bridges. */
export interface FileViewerActionContext {
  /** The file currently shown in the viewer. */
  entry: FileEntry;
  /** The preloaded text, when the viewer is text/markdown (already fetched by the host). */
  text?: TextPayload | null;
  /** Load the file's raw bytes (image/pdf); undefined when the host can't provide them. */
  loadBytes?: () => Promise<Uint8Array>;
  apiFor: (serviceId: string) => ServiceApiClient;
  ui: ServiceUiBridge;
  user: SessionUser;
  openService: (serviceId: string, subPath?: string) => void;
  /** Close the action panel. */
  close: () => void;
}

/** A file-level action a service contributes to the shared file viewer (e.g. aigentic's "Ask AI"),
 *  scoped to the single displayed file. Registered at module load via {@link registerViewerAction};
 *  {@link FilePreview} renders a button per applicable action and mounts its Panel when clicked —
 *  so the feature works in EVERY FilePreview host (Files, Mail, …) without any host importing it. */
export interface FileViewerAction {
  /** Stable id, namespaced by the contributing service (e.g. "aigentic.ask.file"). */
  id: string;
  /** Toolbar button label. */
  label: string;
  /** Toolbar button icon. */
  icon?: ComponentType<{ className?: string }>;
  /** Visibility gate (e.g. only users holding the service's run right); omitted → always. */
  visible?: (user: SessionUser) => boolean;
  /** Whether the action applies to a given file (e.g. only AI-readable types); omitted → always. */
  applies?: (entry: FileEntry) => boolean;
  /** The panel rendered when the action is opened; owns its own UX + network calls. */
  Panel: ComponentType<FileViewerActionContext>;
}

const registry = createActionRegistry<FileViewerAction>();

/** Register a viewer action. Idempotent by id (safe across hot reloads / repeated imports). */
export function registerViewerAction(action: FileViewerAction): void {
  registry.register(action);
}

/** All registered viewer actions, in registration order. FilePreview filters by visibility + type. */
export function viewerActions(): readonly FileViewerAction[] {
  return registry.all();
}
