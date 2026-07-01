import { useState, type DragEvent, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './lib/cn';

export type TreeNavPosition = 'before' | 'after' | 'inside';

export interface TreeNavNode {
  id: string;
  label: string;
  icon?: ReactNode;
  /** Trailing content (count badge, etc.). */
  badge?: ReactNode;
  /** Indent level; 0 is a root row. */
  depth?: number;
  active?: boolean;
  /** Whether this row can be picked up and dragged. Default false. */
  draggable?: boolean;
  /** Whether another row may be dropped INTO this one (nested under it). Default false. */
  droppable?: boolean;
}

export interface TreeNavProps {
  nodes: TreeNavNode[];
  onSelect?: (id: string) => void;
  /** Double-click a row (e.g. to rename it inline). */
  onNodeDoubleClick?: (id: string) => void;
  /**
   * Fires when a drag is dropped. `position` is relative to `targetId`: 'inside' nests the dragged
   * node under the target; 'before'/'after' places it as a sibling. The consumer maps this gesture
   * onto its own model (reorder and/or re-parent).
   */
  onMove?: (dragId: string, targetId: string, position: TreeNavPosition) => void;
  /** Optional trailing per-row actions (e.g. a context menu); clicks here don't select the row. */
  rowActions?: (node: TreeNavNode) => ReactNode;
  /**
   * Accept an EXTERNAL drag (not a node being reordered) dropped onto a row — e.g. messages dragged
   * from a list onto a folder. Only fires when the drag carries `externalDropType`.
   */
  onExternalDrop?: (targetId: string, dataTransfer: DataTransfer) => void;
  externalDropType?: string;
  className?: string;
}

/**
 * TreeNav is a drag-and-drop, nestable navigation tree. It renders a pre-ordered flat list of rows
 * (the caller supplies each row's `depth`), supports reordering by dragging a row into the gap
 * between two rows and nesting by dropping a row onto another, and reports the gesture via onMove.
 * It is deliberately domain-agnostic — the mail UI translates a move into folder rename/reorder
 * calls. Lives in the SDK because service UIs may not attach raw DnD handlers themselves.
 */
export function TreeNav({ nodes, onSelect, onNodeDoubleClick, onMove, rowActions, onExternalDrop, externalDropType, className }: TreeNavProps) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<{ id: string; pos: TreeNavPosition } | null>(null);

  function positionFor(e: DragEvent<HTMLDivElement>, node: TreeNavNode): TreeNavPosition {
    const r = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - r.top;
    if (node.droppable && y > r.height * 0.3 && y < r.height * 0.7) return 'inside';
    return y < r.height / 2 ? 'before' : 'after';
  }

  function isExternalDrag(e: DragEvent<HTMLDivElement>): boolean {
    return !!onExternalDrop && !!externalDropType && Array.from(e.dataTransfer.types).includes(externalDropType);
  }

  return (
    <div className={cn('flex flex-col gap-0.5', className)} role="tree">
      {nodes.map((node) => {
        const indicate = over && over.id === node.id ? over.pos : null;
        return (
          <div
            key={node.id}
            role="treeitem"
            aria-selected={node.active || undefined}
            aria-level={(node.depth ?? 0) + 1}
            draggable={node.draggable}
            onDragStart={(e) => {
              setDragId(node.id);
              e.dataTransfer.effectAllowed = 'move';
              try {
                e.dataTransfer.setData('text/plain', node.id);
              } catch {
                /* some browsers restrict setData; the id is also held in state */
              }
            }}
            onDragOver={(e) => {
              if (dragId && dragId !== node.id) {
                e.preventDefault();
                setOver({ id: node.id, pos: positionFor(e, node) });
              } else if (!dragId && isExternalDrag(e)) {
                // An external item (e.g. a dragged message) may be dropped INTO any folder.
                e.preventDefault();
                setOver({ id: node.id, pos: 'inside' });
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (dragId && dragId !== node.id && over && over.id === node.id) {
                onMove?.(dragId, node.id, over.pos);
              } else if (!dragId && isExternalDrag(e)) {
                onExternalDrop?.(node.id, e.dataTransfer);
              }
              setDragId(null);
              setOver(null);
            }}
            onDragEnd={() => {
              setDragId(null);
              setOver(null);
            }}
            className="relative"
          >
            {indicate === 'before' && <div className="pointer-events-none absolute inset-x-1 top-0 z-10 h-0.5 rounded bg-accent" />}
            {indicate === 'after' && <div className="pointer-events-none absolute inset-x-1 bottom-0 z-10 h-0.5 rounded bg-accent" />}
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelect?.(node.id)}
              onDoubleClick={() => onNodeDoubleClick?.(node.id)}
              onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect?.(node.id);
                }
              }}
              className={cn(
                'group flex cursor-pointer items-center gap-2 rounded-lg py-1.5 pr-1.5 text-footnote transition-colors',
                node.active ? 'bg-accent/15 font-medium text-text-primary' : 'text-text-secondary hover:bg-fill/10',
                dragId === node.id && 'opacity-40',
                indicate === 'inside' && 'ring-2 ring-inset ring-accent',
              )}
              style={{ paddingLeft: 8 + (node.depth ?? 0) * 16 }}
            >
              {node.icon && <span className="shrink-0 text-text-tertiary">{node.icon}</span>}
              <span className="min-w-0 flex-1 truncate">{node.label}</span>
              {node.badge}
              {rowActions && (
                <span className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100" onClick={(e) => e.stopPropagation()}>
                  {rowActions(node)}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
