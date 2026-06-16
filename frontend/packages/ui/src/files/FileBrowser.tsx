import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Grid, Spinner, EmptyState } from '../primitives';
import { ContextMenu, type MenuItem } from '../overlay/menu';
import { CopyIcon, DownloadIcon, FolderIcon, InfoIcon, MoveIcon, PencilIcon, TrashIcon } from '../icons';
import { useT } from '../i18n';
import type { FileEntry } from '../plugin/contract';
import { FileEntryIcon } from './parts';

export type FileActionId = 'open' | 'download' | 'rename' | 'move' | 'copy' | 'delete' | 'info' | 'newFolder' | 'upload';

export interface FileBrowserProps {
  entries: FileEntry[];
  view: 'grid' | 'list';
  selection: Set<string>;
  loading?: boolean;
  error?: string | null;
  /** Paths shown dimmed (e.g. items queued to be moved). */
  cutPaths?: Set<string>;
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

const COL_MIN = 72;
const COL_MAX = 360;
const NAME_MIN = 160; // space always reserved for the Name column when resizing
const LIST_CHROME = 8 + 24 + 16; // wrapper px-1 + row px-3 + two gap-2 gutters
// Header and rows share one template so the columns stay aligned; the widths live in
// custom properties on the list wrapper so a drag never re-renders the rows.
const LIST_TEMPLATE: CSSProperties = { gridTemplateColumns: 'minmax(96px, 1fr) var(--fb-col-size, 112px) var(--fb-col-mod, 128px)' };

/** Drag handle on a list-header column's left edge (pointer-only affordance). */
function ColumnResizeHandle({ onPointerDown }: { onPointerDown: (e: ReactPointerEvent<HTMLSpanElement>) => void }) {
  return (
    <span
      aria-hidden
      onPointerDown={onPointerDown}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      className="group absolute -inset-y-1.5 -left-1.5 flex w-3 cursor-col-resize touch-none justify-center"
    >
      <span className="h-full w-px bg-separator transition-colors group-hover:bg-accent" />
    </span>
  );
}

export function FileBrowser({ entries, view, selection, loading, error, cutPaths, onOpen, onSelectionChange, onAction, emptyAction }: FileBrowserProps) {
  const t = useT();
  // Index of the last clicked item — the anchor for shift-range selection.
  const anchor = useRef<number | null>(null);
  // List-view column widths (px); Name takes the remaining space. Committed once per drag.
  const [colWidths, setColWidths] = useState({ size: 112, modified: 128 });
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    anchor.current = null;
  }, [entries]);

  function targetFor(entry: FileEntry): FileEntry[] {
    if (selection.has(entry.path) && selection.size > 1) return entries.filter((e) => selection.has(e.path));
    return [entry];
  }

  function selectAt(entry: FileEntry, index: number, e: MouseEvent) {
    e.stopPropagation();
    if (e.shiftKey && anchor.current != null) {
      const [lo, hi] = anchor.current < index ? [anchor.current, index] : [index, anchor.current];
      onSelectionChange(new Set(entries.slice(lo, hi + 1).map((x) => x.path)));
      return; // keep the anchor so the range can be re-dragged
    }
    if (e.metaKey || e.ctrlKey) {
      const next = new Set(selection);
      next.has(entry.path) ? next.delete(entry.path) : next.add(entry.path);
      onSelectionChange(next);
    } else {
      onSelectionChange(new Set([entry.path]));
    }
    anchor.current = index;
  }

  function clearSelection() {
    anchor.current = null;
    if (selection.size) onSelectionChange(new Set());
  }

  function ensureSelected(entry: FileEntry) {
    if (!selection.has(entry.path)) onSelectionChange(new Set([entry.path]));
  }

  function beginColumnResize(e: ReactPointerEvent<HTMLSpanElement>, col: 'size' | 'modified') {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    const id = e.pointerId;
    const startX = e.clientX;
    const startWidth = colWidths[col];
    const other = col === 'size' ? colWidths.modified : colWidths.size;
    const container = listRef.current?.clientWidth;
    const max = container ? Math.max(COL_MIN, Math.min(COL_MAX, container - LIST_CHROME - other - NAME_MIN)) : COL_MAX;
    let width = startWidth;
    const onMove = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      // The handle sits on the column's left edge — dragging left widens it.
      width = Math.min(max, Math.max(COL_MIN, startWidth - (ev.clientX - startX)));
      listRef.current?.style.setProperty(col === 'size' ? '--fb-col-size' : '--fb-col-mod', `${width}px`);
    };
    const stop = (ev: PointerEvent) => {
      if (ev.pointerId !== id) return;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', stop);
      window.removeEventListener('pointercancel', stop);
      document.body.style.cursor = '';
      setColWidths((w) => ({ ...w, [col]: width }));
    };
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', stop);
    window.addEventListener('pointercancel', stop);
  }

  function contextItems(entry: FileEntry): MenuItem[] {
    const targets = targetFor(entry);
    const single = targets.length === 1;
    const onlyFiles = targets.every((t) => t.kind === 'file');
    const items: MenuItem[] = [{ id: 'open', label: t('common.open'), icon: <FolderIcon />, onSelect: () => onOpen(entry) }];
    if (onlyFiles) items.push({ id: 'download', label: t('common.download'), icon: <DownloadIcon />, onSelect: () => onAction('download', targets) });
    if (single) items.push({ id: 'rename', label: t('common.rename'), icon: <PencilIcon />, onSelect: () => onAction('rename', targets) });
    items.push({ id: 'copy', label: t('common.copy'), icon: <CopyIcon />, onSelect: () => onAction('copy', targets) });
    items.push({ id: 'move', label: t('common.move'), icon: <MoveIcon />, onSelect: () => onAction('move', targets) });
    if (single) items.push({ id: 'info', label: t('files.getInfo'), icon: <InfoIcon />, onSelect: () => onAction('info', targets) });
    items.push({ id: 'delete', label: t('common.delete'), icon: <TrashIcon />, danger: true, separatorBefore: true, onSelect: () => onAction('delete', targets) });
    return items;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (error) {
    return <EmptyState icon={<InfoIcon />} title={t('files.loadError')} description={error} />;
  }
  if (entries.length === 0) {
    return <EmptyState icon={<FolderIcon />} title={t('files.empty')} description={t('files.emptyHint')} action={emptyAction} />;
  }

  if (view === 'grid') {
    return (
      <Grid minItemWidth={132} gap={3} className="p-1 min-h-[240px] content-start" onClick={clearSelection}>
        {entries.map((entry, i) => (
          <ContextMenu key={entry.path} items={contextItems(entry)}>
            <button
              type="button"
              onClick={(e) => selectAt(entry, i, e)}
              onDoubleClick={() => onOpen(entry)}
              onContextMenu={() => ensureSelected(entry)}
              className={cn(
                'group flex aspect-square flex-col items-center justify-center gap-2 rounded-md p-3 text-center transition-colors',
                selection.has(entry.path) ? 'bg-accent/15 ring-1 ring-accent/40' : 'hover:bg-fill/10',
                cutPaths?.has(entry.path) && 'opacity-40',
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
    <div
      ref={listRef}
      className="px-1 min-h-[240px]"
      style={{ '--fb-col-size': `${colWidths.size}px`, '--fb-col-mod': `${colWidths.modified}px` } as CSSProperties}
      onClick={clearSelection}
    >
      <div className="grid gap-2 px-3 py-1.5 text-caption font-medium text-text-tertiary border-b border-separator" style={LIST_TEMPLATE}>
        <span className="truncate">{t('files.colName')}</span>
        <span className="relative pl-2">
          {t('files.colSize')}
          <ColumnResizeHandle onPointerDown={(e) => beginColumnResize(e, 'size')} />
        </span>
        <span className="relative pl-2">
          {t('files.colModified')}
          <ColumnResizeHandle onPointerDown={(e) => beginColumnResize(e, 'modified')} />
        </span>
      </div>
      {entries.map((entry, i) => (
        <ContextMenu key={entry.path} items={contextItems(entry)}>
          <button
            type="button"
            onClick={(e) => selectAt(entry, i, e)}
            onDoubleClick={() => onOpen(entry)}
            onContextMenu={() => ensureSelected(entry)}
            className={cn(
              'grid w-full items-center gap-2 rounded-md px-3 h-11 text-left transition-colors',
              selection.has(entry.path) ? 'bg-accent/15' : 'hover:bg-fill/10',
              cutPaths?.has(entry.path) && 'opacity-40',
            )}
            style={LIST_TEMPLATE}
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
