import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from './cn';

/** The shared type-ahead engine: one debounced, stale-guarded async search with keyboard-navigable
 *  dropdown state. Autocomplete (single free-text value) and ContactPicker (multi-value chips) both
 *  build on it, so the search/stale-guard/blur/keyboard logic lives once. Internal to the SDK — the
 *  public surface is the two components, not this core. */

export interface UseTypeaheadParams<T> {
  /** Current search text. A single-value field passes its controlled value; a chip picker its
   *  internal draft query. */
  query: string;
  onSearch: (query: string) => Promise<T[]>;
  disabled?: boolean;
  minChars: number;
  debounceMs: number;
}

export interface Typeahead<T> {
  open: boolean;
  setOpen: (open: boolean) => void;
  loading: boolean;
  options: T[];
  active: number;
  setActive: (index: number) => void;
  /** Clear the result list and close — the list half of a picker's input reset. */
  reset: () => void;
  /** Close after a short delay so a click on an option registers before the input's blur fires. */
  scheduleClose: () => void;
  /** Suppress exactly one upcoming query-triggered search — e.g. after a selection writes its label
   *  back into a controlled input — and invalidate any in-flight search so it can't reopen. */
  suppressNextSearch: () => void;
  /** ArrowDown: open (if there are `length` rows) and advance the active row. */
  moveDown: (length: number) => void;
  /** ArrowUp: retreat the active row. */
  moveUp: () => void;
}

export function useTypeahead<T>({ query, onSearch, disabled, minChars, debounceMs }: UseTypeaheadParams<T>): Typeahead<T> {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<T[]>([]);
  const [active, setActive] = useState(-1);

  // Search callback via ref so the debounce effect depends only on the query, not on the identity
  // churn of inline callbacks (callers needn't memoize).
  const searchRef = useRef(onSearch);
  searchRef.current = onSearch;
  // Monotonic id; a search that resolves with a stale id (a newer query superseded it) is dropped.
  const seq = useRef(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Set to skip the next query-triggered search (a selection wrote its label back into the field).
  const skip = useRef(false);

  useEffect(() => {
    if (skip.current) {
      skip.current = false;
      setOpen(false);
      return;
    }
    // Bump seq on every short-circuit too, so any in-flight search is invalidated (its late
    // resolution won't reopen the dropdown with stale results), and clear the spinner.
    if (disabled) {
      seq.current++;
      setLoading(false);
      return;
    }
    const q = query.trim();
    if (q.length < minChars) {
      seq.current++;
      setLoading(false);
      setOptions([]);
      setOpen(false);
      return;
    }
    const id = ++seq.current;
    const timer = setTimeout(() => {
      setLoading(true);
      searchRef.current(q).then(
        (res) => {
          if (id !== seq.current) return; // a newer query superseded this one
          setOptions(res);
          setActive(-1);
          setOpen(true);
          setLoading(false);
        },
        () => {
          if (id !== seq.current) return;
          setOptions([]);
          setOpen(true);
          setLoading(false);
        },
      );
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [query, disabled, minChars, debounceMs]);

  useEffect(() => () => clearTimeout(blurTimer.current), []);

  return {
    open,
    setOpen,
    loading,
    options,
    active,
    setActive,
    reset: () => {
      setOptions([]);
      setOpen(false);
      setActive(-1);
    },
    scheduleClose: () => {
      // Delay close so a click on an option registers first.
      blurTimer.current = setTimeout(() => setOpen(false), 150);
    },
    suppressNextSearch: () => {
      skip.current = true;
      seq.current++;
    },
    moveDown: (length: number) => {
      if (!open && length) setOpen(true);
      setActive((a) => Math.min(a + 1, length - 1));
    },
    moveUp: () => setActive((a) => Math.max(a - 1, 0)),
  };
}

export interface TypeaheadListboxProps<T> {
  options: T[];
  active: number;
  setActive: (index: number) => void;
  emptyLabel: ReactNode;
  getKey: (option: T, index: number) => string;
  renderOption: (option: T) => ReactNode;
  onPick: (option: T) => void;
  /** Row horizontal padding — the only visual seam between the two type-aheads. */
  optionClassName?: string;
}

/** The floating result list shared by every type-ahead: an absolutely-positioned dropdown of
 *  selectable rows with an empty state, mouse-hover to arm a row, and mousedown-preventDefault so an
 *  option click lands before the input blurs. Each caller supplies its own row via `renderOption`. */
export function TypeaheadListbox<T>({ options, active, setActive, emptyLabel, getKey, renderOption, onPick, optionClassName = 'px-3' }: TypeaheadListboxProps<T>) {
  return (
    // preventDefault on mousedown keeps the input focused so the option click fires before blur.
    <ul
      className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-separator bg-surface-raised p-1 shadow-elev-2"
      onMouseDown={(e) => e.preventDefault()}
    >
      {options.length === 0 ? (
        <li className="px-3 py-2 text-footnote text-text-tertiary">{emptyLabel}</li>
      ) : (
        options.map((o, i) => (
          <li key={getKey(o, i)}>
            <button
              type="button"
              onClick={() => onPick(o)}
              onMouseEnter={() => setActive(i)}
              className={cn('flex w-full items-center gap-2 rounded-sm py-1.5 text-left', optionClassName, i === active ? 'bg-fill/10' : 'hover:bg-fill/10')}
            >
              {renderOption(o)}
            </button>
          </li>
        ))
      )}
    </ul>
  );
}
