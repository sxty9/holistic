import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './lib/cn';
import { Input } from './controls';
import { Spinner } from './primitives';

export interface AutocompleteOption {
  id: string;
  label: string; // primary line (also the value a selection writes back)
  sublabel?: string; // secondary line, e.g. an address
  data?: unknown; // opaque payload carried back to onSelect (avoids a stale shared lookup map)
}

export interface AutocompleteProps {
  value: string;
  onChange: (value: string) => void; // free-text edits to the field
  onSearch: (query: string) => Promise<AutocompleteOption[]>;
  onSelect: (option: AutocompleteOption) => void;
  placeholder?: string;
  disabled?: boolean;
  debounceMs?: number;
  minChars?: number;
  className?: string;
  emptyText?: ReactNode;
}

// Autocomplete is a generic async type-ahead: a text input that debounces into onSearch and shows
// a selectable dropdown of results. It stays a plain controlled input (value/onChange) so callers
// can also accept free text; onSelect fires when a suggestion is chosen (mouse or keyboard).
export function Autocomplete({
  value,
  onChange,
  onSearch,
  onSelect,
  placeholder,
  disabled,
  debounceMs = 300,
  minChars = 2,
  className,
  emptyText = 'No matches',
}: AutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<AutocompleteOption[]>([]);
  const [active, setActive] = useState(-1);
  const [searched, setSearched] = useState(false);

  // Callbacks via refs so the debounce effect depends only on the query, not on identity churn of
  // inline callbacks (callers needn't memoize).
  const searchRef = useRef(onSearch);
  searchRef.current = onSearch;
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const seq = useRef(0);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Set when a selection writes its label back into `value`, so the resulting value change does
  // not trigger a fresh search that would immediately re-open the dropdown on the chosen text.
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
    const q = value.trim();
    if (q.length < minChars) {
      seq.current++;
      setLoading(false);
      setOptions([]);
      setSearched(false);
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
          setSearched(true);
          setActive(-1);
          setOpen(true);
          setLoading(false);
        },
        () => {
          if (id !== seq.current) return;
          setOptions([]);
          setSearched(true);
          setOpen(true);
          setLoading(false);
        },
      );
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [value, disabled, minChars, debounceMs]);

  useEffect(() => () => clearTimeout(blurTimer.current), []);

  function choose(opt: AutocompleteOption) {
    // Arm the skip guard so the value change this selection causes does not trigger a fresh
    // search, and invalidate any in-flight search so it can't reopen the dropdown afterwards.
    skip.current = true;
    seq.current++;
    selectRef.current(opt);
    setOpen(false);
    setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && options.length) setOpen(true);
      setActive((a) => Math.min(a + 1, options.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && active >= 0 && active < options.length) {
        e.preventDefault();
        choose(options[active]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => options.length > 0 && setOpen(true)}
        onBlur={() => {
          // Delay close so a click on an option registers first.
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {loading && (
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          <Spinner />
        </div>
      )}
      {open && searched && (
        // preventDefault on mousedown keeps the input focused so the option click fires before blur.
        <ul
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border border-separator bg-surface-raised p-1 shadow-elev-2"
          onMouseDown={(e) => e.preventDefault()}
        >
          {options.length === 0 ? (
            <li className="px-3 py-2 text-footnote text-text-tertiary">{emptyText}</li>
          ) : (
            options.map((o, i) => (
              <li key={o.id || `${o.label}-${i}`}>
                <button
                  type="button"
                  onClick={() => choose(o)}
                  onMouseEnter={() => setActive(i)}
                  className={cn(
                    'flex w-full flex-col items-start rounded-sm px-3 py-1.5 text-left',
                    i === active ? 'bg-fill/10' : 'hover:bg-fill/10',
                  )}
                >
                  <span className="text-subhead text-text-primary">{o.label}</span>
                  {o.sublabel && <span className="text-footnote text-text-secondary">{o.sublabel}</span>}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
