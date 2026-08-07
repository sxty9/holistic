import { useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './lib/cn';
import { Avatar, Spinner } from './primitives';
import { XIcon } from './icons';
import { useT } from './i18n';
import { useTypeahead, TypeaheadListbox } from './lib/typeahead';

// A contact as the picker exchanges it: the address is the value that goes on the wire; the rest is
// display. `username` marks an internal directory user (populated by the host's directory lookup).
// Hosts wire `onSearch` to their directory service's lookup endpoint (recipient / attendee pickers).
//
// A search may also return contax PERSONAL GROUPS (kind:'group', with a groupId and memberCount).
// A group is never itself added to the value — selecting it calls `onExpandGroup(groupId)` and the
// resolved member addresses are merged in as ordinary contacts, so the value stays a plain address
// list. Hosts that don't pass `onExpandGroup` simply never surface groups.
export interface ContactOption {
  email: string;
  displayName: string;
  avatarUrl?: string | null;
  username?: string;
  /** 'group' marks a contax personal group (expanded on select); anything else is a contact. */
  kind?: 'contact' | 'group';
  /** Group id, present iff kind === 'group'. */
  groupId?: string;
  /** Member count, shown as the group option's subtitle. */
  memberCount?: number;
}

export interface ContactPickerProps {
  value: ContactOption[];
  onChange: (value: ContactOption[]) => void;
  /** Async directory search (typically apiFor('contax').get('lookup?q=…')). May include groups. */
  onSearch: (query: string) => Promise<ContactOption[]>;
  /** Resolve a selected group to its member contacts (typically
   *  apiFor('contax').get('groups/<id>/members')). Required to surface group options. */
  onExpandGroup?: (groupId: string) => Promise<ContactOption[]>;
  placeholder?: string;
  disabled?: boolean;
  debounceMs?: number;
  minChars?: number;
  /** Allow committing a raw, non-contact email address with Enter (default true). */
  allowFreeText?: boolean;
  className?: string;
  emptyText?: ReactNode;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const norm = (e: string) => e.trim().toLowerCase();

// ContactPicker is a multi-value, avatar-aware type-ahead: results and selected chips both show the
// contact's profile picture before their name (a Gravatar/host-provided avatar, falling back to initials
// via the SDK Avatar). Selections become removable chips; the underlying value is always the email
// list, so a host can keep sending to plain addresses. Free-typed addresses are accepted too, so it
// augments — never replaces — direct address entry. The debounce/stale-guard/dropdown machinery is the
// shared useTypeahead engine (see ./lib/typeahead); only the chip surface and group expansion are local.
export function ContactPicker({
  value,
  onChange,
  onSearch,
  onExpandGroup,
  placeholder,
  disabled,
  debounceMs = 250,
  minChars = 1,
  allowFreeText = true,
  className,
  emptyText,
}: ContactPickerProps) {
  const t = useT();
  const emptyLabel = emptyText ?? t('common.noMatches');
  const [query, setQuery] = useState('');
  const ta = useTypeahead<ContactOption>({ query, onSearch, disabled, minChars, debounceMs });

  const expandRef = useRef(onExpandGroup);
  expandRef.current = onExpandGroup;
  // Latest value, so an async group expansion merges into the current selection, not a stale one.
  const valueRef = useRef(value);
  valueRef.current = value;

  const chosen = new Set(value.map((v) => norm(v.email)));
  // Hide options already chosen so the dropdown never offers a duplicate.
  const shown = ta.options.filter((o) => !chosen.has(norm(o.email)));

  function resetInput() {
    setQuery('');
    ta.reset();
  }

  function add(opt: ContactOption) {
    if (opt.kind === 'group') {
      if (opt.groupId) void addGroup(opt.groupId);
      resetInput();
      return;
    }
    if (!opt.email.trim()) return;
    if (!chosen.has(norm(opt.email))) onChange([...value, opt]);
    resetInput();
  }

  // addGroup expands a selected group into its members and merges the (email-deduped) members into
  // the current value. The group itself is never added — the value stays a plain address list.
  async function addGroup(groupId: string) {
    const expand = expandRef.current;
    if (!expand) return;
    try {
      const members = await expand(groupId);
      const merged = [...valueRef.current];
      const have = new Set(merged.map((v) => norm(v.email)));
      for (const m of members) {
        const e = norm(m.email);
        if (e && !have.has(e)) {
          have.add(e);
          merged.push(m);
        }
      }
      onChange(merged);
    } catch {
      // Expansion failed — leave the current selection unchanged.
    }
  }

  function removeAt(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      ta.moveDown(shown.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      ta.moveUp();
    } else if (e.key === 'Enter') {
      if (ta.open && ta.active >= 0 && ta.active < shown.length) {
        e.preventDefault();
        add(shown[ta.active]);
      } else if (allowFreeText && EMAIL_RE.test(query.trim())) {
        e.preventDefault();
        const email = query.trim();
        add({ email, displayName: email });
      }
    } else if (e.key === 'Escape') {
      ta.setOpen(false);
    } else if (e.key === 'Backspace' && query === '' && value.length) {
      removeAt(value.length - 1);
    }
  }

  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          'flex min-h-10 w-full flex-wrap items-center gap-1.5 rounded-md border border-separator bg-surface-raised px-2 py-1.5',
          'focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/50',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        {value.map((c, i) => (
          <span
            key={norm(c.email) + i}
            className="inline-flex items-center gap-1.5 rounded-full bg-fill/15 py-0.5 pl-0.5 pr-1.5 text-footnote"
          >
            <Avatar name={c.displayName || c.email} src={c.avatarUrl || undefined} size={20} />
            <span className="text-text-primary">{c.displayName || c.email}</span>
            <button
              type="button"
              aria-label={t('common.remove', { name: c.displayName || c.email })}
              onClick={() => removeAt(i)}
              className="text-text-tertiary hover:text-text-secondary"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          onFocus={() => shown.length > 0 && ta.setOpen(true)}
          onBlur={ta.scheduleClose}
          placeholder={value.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="min-w-[8rem] flex-1 bg-transparent px-1 text-subhead text-text-primary placeholder:text-text-tertiary focus:outline-none"
          role="combobox"
          aria-expanded={ta.open}
          aria-autocomplete="list"
          autoComplete="off"
        />
        {ta.loading && <Spinner className="h-4 w-4" />}
      </div>
      {ta.open && (
        <TypeaheadListbox
          options={shown}
          active={ta.active}
          setActive={ta.setActive}
          emptyLabel={emptyLabel}
          optionClassName="px-2"
          getKey={(o, i) => (o.groupId || o.username || norm(o.email)) + i}
          onPick={add}
          renderOption={(o) => (
            <>
              <Avatar name={o.displayName || o.email} src={o.avatarUrl || undefined} size={28} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-subhead text-text-primary">{o.displayName || o.email}</span>
                <span className="truncate text-footnote text-text-secondary">
                  {o.kind === 'group' ? t('contact.group', { count: o.memberCount ?? 0 }) : o.email}
                </span>
              </span>
            </>
          )}
        />
      )}
    </div>
  );
}
