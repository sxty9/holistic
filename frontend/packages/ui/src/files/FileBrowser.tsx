import type { MouseEvent, ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Grid, Spinner, EmptyState } from '../primitives';
import { ContextMenu, type MenuItem } from '../overlay/menu';
import { DownloadIcon, FolderIcon, InfoIcon, MoveIcon, PencilIcon, TrashIcon } from '../icons';
import type { FileEntry } from '../plugin/contract';
import { FileEntryIcon } from './parts';

export type FileActionId = 'open' | 'download' | 'rename' | 'move' | 'delete' | 'info' | 'newFolder' | 'upload';

export interface FileBrowserProps {
  entries: FileEntry[];
  view: 'grid' | 'list';
  selection: Set<string>;
  loading?: boolean;
  error?: string | null;
  onOpen: (entry: FileEntry) => void;
  onSelectionChange: (selection: Set<string>) => void;
  onAction: (action: FileActionId, entries: FileEntry[]) => void;
  emptyAction?: ReactNode;
}

export function formatBytes(n: number): string {
  if (n <= 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}
export function formatDate(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function FileBrowser({ entries, view, selection, loading, error, onOpen, onSelectionChange, onAction, emptyAction }: FileBrowserProps) {
  function targetFor(entry: FileEntry): FileEntry[] {
    if (selection.has(entry.path) && selection.size > 1) return entries.filter((e) => selection.has(e.path));
    return [entry];
  }

  function clickSelect(entry: FileEntry, e: MouseEvent) {
    const next = new Set(selection);
    if (e.metaKey || e.ctrlKey) {
      next.has(entry.path) ? next.delete(entry.path) : next.add(entry.path);
    } else {
      next.clear();
      next.add(entry.path);
    }
    onSelectionChange(next);
  }

  function contextItems(entry: FileEntry): MenuItem[] {
    const targets = targetFor(entry);
    const single = targets.length === 1;
    const onlyFiles = targets.every((t) => t.kind === 'file');
    const items: MenuItem[] = [{ id: 'open', label: 'Open', icon: <FolderIcon />, onSelect: () => onOpen(entry) }];
    if (onlyFiles) items.push({ id: 'download', label: 'Download', icon: <DownloadIcon />, onSelect: () => onAction('download', targets) });
    if (single) items.push({ id: 'rename', label: 'Rename', icon: <PencilIcon />, onSelect: () => onAction('rename', targets) });
    items.push({ id: 'move', label: 'Move…', icon: <MoveIcon />, onSelect: () => onAction('move', targets) });
    if (single) items.push({ id: 'info', label: 'Get Info', icon: <InfoIcon />, onSelect: () => onAction('info', targets) });
    items.push({ id: 'delete', label: 'Delete', icon: <TrashIcon />, danger: true, separatorBefore: true, onSelect: () => onAction('delete', targets) });
    return items;
  }

  function ensureSelected(entry: FileEntry) {
    if (!selection.has(entry.path)) onSelectionChange(new Set([entry.path]));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (error) {
    return <EmptyState icon={<InfoIcon />} title="Couldn’t load this folder" description={error} />;
  }
  if (entries.length === 0) {
    return <EmptyState icon={<FolderIcon />} title="This folder is empty" description="Upload files or create a folder to get started." action={emptyAction} />;
  }

  if (view === 'grid') {
    return (
      <Grid minItemWidth={132} gap={3} className="p-1">
        {entries.map((entry) => (
          <ContextMenu key={entry.path} items={contextItems(entry)}>
            <button
              type="button"
              onClick={(e) => clickSelect(entry, e)}
              onDoubleClick={() => onOpen(entry)}
              onContextMenu={() => ensureSelected(entry)}
              className={cn(
                'group flex flex-col items-center gap-2 rounded-md p-3 text-center transition-colors',
                selection.has(entry.path) ? 'bg-accent/15 ring-1 ring-accent/40' : 'hover:bg-text-tertiary/10',
              )}
            >
              <FileEntryIcon entry={entry} className="h-12 w-12" />
              <span className="w-full truncate text-footnote text-text-primary">{entry.name}</span>
            </button>
          </ContextMenu>
        ))}
      </Grid>
    );
  }

  return (
    <div className="px-1">
      <div className="grid grid-cols-[1fr_7rem_8rem] gap-2 px-3 py-1.5 text-caption font-medium text-text-tertiary border-b border-separator">
        <span>Name</span>
        <span className="text-right">Size</span>
        <span className="text-right">Modified</span>
      </div>
      {entries.map((entry) => (
        <ContextMenu key={entry.path} items={contextItems(entry)}>
          <button
            type="button"
            onClick={(e) => clickSelect(entry, e)}
            onDoubleClick={() => onOpen(entry)}
            onContextMenu={() => ensureSelected(entry)}
            className={cn(
              'grid w-full grid-cols-[1fr_7rem_8rem] items-center gap-2 rounded-md px-3 h-11 text-left transition-colors',
              selection.has(entry.path) ? 'bg-accent/15' : 'hover:bg-text-tertiary/10',
            )}
          >
            <span className="flex items-center gap-2.5 min-w-0">
              <FileEntryIcon entry={entry} className="h-5 w-5 shrink-0" />
              <span className="truncate text-subhead text-text-primary">{entry.name}</span>
            </span>
            <span className="text-right text-footnote text-text-secondary tabular-nums">{entry.kind === 'dir' ? '—' : formatBytes(entry.size)}</span>
            <span className="text-right text-footnote text-text-secondary tabular-nums">{formatDate(entry.mtime)}</span>
          </button>
        </ContextMenu>
      ))}
    </div>
  );
}
