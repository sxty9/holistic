import { useMemo, useState, type ReactNode } from 'react';
import { cn } from './lib/cn';
import { ChevronDownIcon } from './icons';
import { ScrollArea } from './primitives';
import { Checkbox } from './controls';

export type SortDir = 'asc' | 'desc';

export interface Column<Row> {
  key: string;
  header: ReactNode;
  align?: 'left' | 'right';
  sortable?: boolean;
  width?: number | string;
  /** Cell renderer; falls back to the row's `key` field stringified. */
  render?: (row: Row) => ReactNode;
  /** Comparable value for sorting; required for `sortable` columns. */
  sortValue?: (row: Row) => number | string;
  /** When `columnToggle` is on, whether this column can be hidden (default true). */
  hideable?: boolean;
  /** When `columnToggle` is on, start hidden (user can re-enable it). */
  defaultHidden?: boolean;
  /** Optional short label for the toggle checkbox (defaults to `header`). */
  toggleLabel?: ReactNode;
}

export interface DataTableProps<Row> {
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  initialSort?: { key: string; dir: SortDir };
  /** Caps the body height and makes the header sticky. */
  maxHeight?: number;
  onRowClick?: (row: Row) => void;
  emptyState?: ReactNode;
  /** Render a row of checkboxes above the table to show/hide hideable columns. */
  columnToggle?: boolean;
  className?: string;
}

/** Sortable, sticky-header data table (e.g. the Task-Manager process list). */
export function DataTable<Row>({ columns, rows, rowKey, initialSort, maxHeight, onRowClick, emptyState, columnToggle, className }: DataTableProps<Row>) {
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(initialSort ?? null);
  const [hidden, setHidden] = useState<Set<string>>(() => new Set(columns.filter((c) => c.defaultHidden).map((c) => c.key)));

  const visible = columnToggle ? columns.filter((c) => !hidden.has(c.key)) : columns;

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const get = col.sortValue;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return 0;
    });
  }, [rows, columns, sort]);

  function toggle(col: Column<Row>) {
    if (!col.sortable) return;
    setSort((s) => (s?.key === col.key ? { key: col.key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: col.key, dir: 'desc' }));
  }

  const toggleable = columns.filter((c) => c.hideable !== false);

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {columnToggle && toggleable.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1">
          {toggleable.map((col) => (
            <Checkbox
              key={col.key}
              checked={!hidden.has(col.key)}
              label={col.toggleLabel ?? col.header}
              onChange={(checked) =>
                setHidden((prev) => {
                  const next = new Set(prev);
                  if (checked) next.delete(col.key);
                  else next.add(col.key);
                  return next;
                })
              }
            />
          ))}
        </div>
      )}
      <ScrollArea className="w-full" style={maxHeight ? { maxHeight } : undefined}>
        <table className="w-full border-collapse text-footnote">
          <thead className="sticky top-0 z-10 bg-surface-raised">
            <tr className="border-b border-separator">
              {visible.map((col) => (
              <th
                key={col.key}
                style={col.width ? { width: col.width } : undefined}
                className={cn(
                  'px-3 py-2 font-medium text-text-secondary select-none',
                  col.align === 'right' ? 'text-right' : 'text-left',
                  col.sortable && 'cursor-pointer hover:text-text-primary',
                )}
                onClick={() => toggle(col)}
              >
                <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'flex-row-reverse')}>
                  {col.header}
                  {col.sortable && sort?.key === col.key && (
                    <ChevronDownIcon className={cn('h-3.5 w-3.5 transition-transform', sort.dir === 'asc' && 'rotate-180')} />
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn('border-b border-separator/60 last:border-0', onRowClick && 'cursor-pointer hover:bg-fill/5')}
            >
              {visible.map((col) => (
                <td
                  key={col.key}
                  className={cn('px-3 py-1.5 text-text-primary', col.align === 'right' ? 'text-right tabular-nums' : 'text-left')}
                >
                  {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
        {sorted.length === 0 && emptyState}
      </ScrollArea>
    </div>
  );
}
