import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './lib/cn';
import { Input } from './controls';
import { Avatar, Spinner } from './primitives';
import { useT } from './i18n';
import { useTypeahead, TypeaheadListbox } from './lib/typeahead';

export interface AutocompleteOption {
  id: string;
  label: string; // primary line (also the value a selection writes back)
  sublabel?: string; // secondary line, e.g. an address
  // A face for this option. Set it (even to '') to give the row an avatar slot; an empty or failing
  // src falls back to initials, exactly as in ContactPicker. Left undefined, the row has no avatar
  // at all, so an autocomplete over things that are not people stays a plain list.
  avatarUrl?: string;
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
// can also accept free text; onSelect fires when a suggestion is chosen (mouse or keyboard). The
// debounce/stale-guard/dropdown machinery is the shared useTypeahead engine (see ./lib/typeahead).
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
  emptyText,
}: AutocompleteProps) {
  const t = useT();
  const emptyLabel = emptyText ?? t('common.noMatches');
  const ta = useTypeahead<AutocompleteOption>({ query: value, onSearch, disabled, minChars, debounceMs });

  // Callback via ref so it never needs threading through the shared engine.
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;

  function choose(opt: AutocompleteOption) {
    // Arm the skip guard so the value change this selection causes does not trigger a fresh search,
    // and invalidate any in-flight search so it can't reopen the dropdown afterwards.
    ta.suppressNextSearch();
    selectRef.current(opt);
    ta.setOpen(false);
    ta.setActive(-1);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      ta.moveDown(ta.options.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      ta.moveUp();
    } else if (e.key === 'Enter') {
      if (ta.open && ta.active >= 0 && ta.active < ta.options.length) {
        e.preventDefault();
        choose(ta.options[ta.active]);
      }
    } else if (e.key === 'Escape') {
      ta.setOpen(false);
    }
  }

  return (
    <div className={cn('relative', className)}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onFocus={() => ta.options.length > 0 && ta.setOpen(true)}
        onBlur={ta.scheduleClose}
        placeholder={placeholder}
        disabled={disabled}
        role="combobox"
        aria-expanded={ta.open}
        aria-autocomplete="list"
        autoComplete="off"
      />
      {ta.loading && (
        <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2">
          <Spinner />
        </div>
      )}
      {ta.open && (
        <TypeaheadListbox
          options={ta.options}
          active={ta.active}
          setActive={ta.setActive}
          emptyLabel={emptyLabel}
          getKey={(o, i) => o.id || `${o.label}-${i}`}
          onPick={choose}
          renderOption={(o) => (
            <>
              {o.avatarUrl !== undefined && <Avatar name={o.label} src={o.avatarUrl || undefined} size={28} />}
              <span className="flex min-w-0 flex-col items-start">
                <span className="text-subhead text-text-primary">{o.label}</span>
                {o.sublabel && <span className="text-footnote text-text-secondary">{o.sublabel}</span>}
              </span>
            </>
          )}
        />
      )}
    </div>
  );
}
