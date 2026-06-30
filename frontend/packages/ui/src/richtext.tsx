import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from './lib/cn';
import { Button, IconButton, Input } from './controls';
import {
  BoldIcon,
  ItalicIcon,
  UnderlineIcon,
  StrikethroughIcon,
  ListIcon,
  ListOrderedIcon,
  LinkIcon,
  QuoteIcon,
  ClearFormatIcon,
} from './icons';

export interface RichTextEditorProps {
  /** Initial HTML. The editor is uncontrolled thereafter — change `resetKey` to load new content. */
  defaultValue?: string;
  /** Fires on every edit with the sanitised HTML ("" when visually empty) and the plain text. */
  onChange?: (html: string, text: string) => void;
  placeholder?: string;
  minHeight?: number;
  maxHeight?: number;
  autoFocus?: boolean;
  className?: string;
  ariaLabel?: string;
  /** Changing this remounts the content from `defaultValue` (e.g. switching reply ↔ new message). */
  resetKey?: string | number;
}

/**
 * RichTextEditor is a dependency-free WYSIWYG editor for composing mail: a contentEditable surface
 * with a formatting toolbar (bold/italic/underline/strikethrough, bulleted/numbered lists, link,
 * quote, clear). It emits sanitised HTML plus a plain-text rendering, so the caller can send a
 * multipart/alternative message. Pasted content is sanitised before insertion. It styles itself
 * from the design tokens, so it adapts to light/dark automatically. This lives in the SDK because
 * service UIs may not touch contentEditable / raw DOM directly.
 */
export function RichTextEditor({
  defaultValue = '',
  onChange,
  placeholder = 'Write your message…',
  minHeight = 220,
  maxHeight,
  autoFocus,
  className,
  ariaLabel = 'Message body',
  resetKey,
}: RichTextEditorProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(() => htmlIsBlank(defaultValue));
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const savedRange = useRef<Range | null>(null);

  // Load (and reload on resetKey) the initial content. Uncontrolled afterwards so the caret never
  // jumps mid-typing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = sanitizeFragment(defaultValue);
    setEmpty(htmlIsBlank(defaultValue));
    if (autoFocus) placeCaretAtEnd(el);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  function emit() {
    const el = ref.current;
    if (!el) return;
    const raw = el.innerHTML;
    const text = el.innerText;
    setEmpty(htmlIsBlank(raw));
    const html = htmlIsBlank(raw) ? '' : sanitizeFragment(raw);
    onChange?.(html, text);
  }

  function refreshActive() {
    if (typeof document === 'undefined') return;
    const q = (c: string) => {
      try {
        return document.queryCommandState(c);
      } catch {
        return false;
      }
    };
    setActive({
      bold: q('bold'),
      italic: q('italic'),
      underline: q('underline'),
      strikeThrough: q('strikeThrough'),
      insertUnorderedList: q('insertUnorderedList'),
      insertOrderedList: q('insertOrderedList'),
    });
  }

  function exec(command: string, value?: string) {
    if (typeof document === 'undefined') return;
    ref.current?.focus();
    try {
      document.execCommand(command, false, value);
    } catch {
      /* unsupported command — ignore */
    }
    emit();
    refreshActive();
  }

  function onPaste(e: ClipboardEvent<HTMLDivElement>) {
    if (typeof document === 'undefined') return;
    e.preventDefault();
    const html = e.clipboardData.getData('text/html');
    const text = e.clipboardData.getData('text/plain');
    const fragment = html ? sanitizeFragment(html) : escapeText(text).replace(/\r?\n/g, '<br>');
    try {
      document.execCommand('insertHTML', false, fragment);
    } catch {
      /* ignore */
    }
    emit();
  }

  function openLink() {
    const sel = typeof window !== 'undefined' ? window.getSelection() : null;
    savedRange.current = sel && sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    setLinkUrl('');
    setLinkOpen(true);
  }

  function applyLink() {
    let url = linkUrl.trim();
    if (url) {
      if (!/^(https?:|mailto:)/i.test(url)) url = 'https://' + url;
      const sel = window.getSelection();
      if (savedRange.current && sel) {
        sel.removeAllRanges();
        sel.addRange(savedRange.current);
      }
      ref.current?.focus();
      if (sel && sel.isCollapsed) {
        document.execCommand('insertHTML', false, `<a href="${escapeAttr(url)}">${escapeText(url)}</a>`);
      } else {
        document.execCommand('createLink', false, url);
      }
      emit();
    }
    setLinkOpen(false);
    setLinkUrl('');
  }

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-lg border border-separator bg-surface', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-separator px-1.5 py-1">
        <Tool icon={<BoldIcon />} label="Bold" active={active.bold} onClick={() => exec('bold')} />
        <Tool icon={<ItalicIcon />} label="Italic" active={active.italic} onClick={() => exec('italic')} />
        <Tool icon={<UnderlineIcon />} label="Underline" active={active.underline} onClick={() => exec('underline')} />
        <Tool icon={<StrikethroughIcon />} label="Strikethrough" active={active.strikeThrough} onClick={() => exec('strikeThrough')} />
        <Separator />
        <Tool icon={<ListIcon />} label="Bulleted list" active={active.insertUnorderedList} onClick={() => exec('insertUnorderedList')} />
        <Tool icon={<ListOrderedIcon />} label="Numbered list" active={active.insertOrderedList} onClick={() => exec('insertOrderedList')} />
        <Tool icon={<QuoteIcon />} label="Quote" onClick={() => exec('formatBlock', 'blockquote')} />
        <Separator />
        <Tool icon={<LinkIcon />} label="Insert link" active={linkOpen} onClick={openLink} />
        <Tool icon={<ClearFormatIcon />} label="Clear formatting" onClick={() => exec('removeFormat')} />
      </div>

      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-separator px-2 py-1.5">
          <Input
            autoFocus
            value={linkUrl}
            placeholder="https://example.com"
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                applyLink();
              } else if (e.key === 'Escape') {
                setLinkOpen(false);
              }
            }}
            className="h-8 flex-1"
          />
          <Button size="sm" variant="primary" onMouseDown={(e) => e.preventDefault()} onClick={applyLink}>
            Add link
          </Button>
          <Button size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => setLinkOpen(false)}>
            Cancel
          </Button>
        </div>
      )}

      <div className="relative min-h-0 flex-1">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          spellCheck
          onInput={emit}
          onBlur={emit}
          onPaste={onPaste}
          onKeyUp={refreshActive}
          onMouseUp={refreshActive}
          onFocus={refreshActive}
          className="holistic-rte h-full overflow-auto px-3 py-2 text-body leading-relaxed text-text-primary outline-none"
          style={{ minHeight, maxHeight }}
        />
        {empty && (
          <div className="pointer-events-none absolute left-3 top-2 select-none text-body text-text-tertiary">{placeholder}</div>
        )}
      </div>
    </div>
  );
}

function Separator() {
  return <div className="mx-1 h-5 w-px bg-separator" aria-hidden="true" />;
}

function Tool({ icon, label, active, onClick }: { icon: ReactNode; label: string; active?: boolean; onClick: () => void }) {
  return (
    <IconButton
      label={label}
      size="sm"
      variant={active ? 'tinted' : 'ghost'}
      // Keep the editor's selection: never let the toolbar button steal focus before execCommand.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {icon}
    </IconButton>
  );
}

// ── helpers ────────────────────────────────────────────────────────────────────────────

function placeCaretAtEnd(el: HTMLElement) {
  el.focus();
  if (typeof window === 'undefined') return;
  const range = document.createRange();
  range.selectNodeContents(el);
  range.collapse(false);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
}

function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** True when the HTML has no visible text and no image (so the caller can send "" → text/plain). */
function htmlIsBlank(html: string): boolean {
  if (/<img\b/i.test(html)) return false;
  const text = stripTags(html).replace(/&nbsp;/gi, ' ').replace(/ /g, ' ');
  return text.trim() === '';
}

function escapeText(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(s: string): string {
  return escapeText(s).replace(/"/g, '&quot;');
}

/**
 * sanitizeFragment strips active/dangerous content while keeping formatting tags and inline styles.
 * It guards both what the editor emits and anything pasted in. The strip passes run to a fixpoint
 * (removing an interposed tag can reconstitute a dangerous one); on* handlers are caught after a
 * slash or quote separator (`<img/onerror>`, `<img src="x"onerror>`), not just whitespace; and URL
 * schemes are checked after de-obfuscation.
 */
function sanitizeFragment(html: string): string {
  let out = html;
  for (let i = 0; i < 64; i++) {
    const prev = out;
    out = out.replace(/<!--[\s\S]*?-->/g, '');
    out = out.replace(/<(script|style|iframe|object|embed|applet|form|link|meta|base|noscript|frame|frameset)\b[\s\S]*?<\/\1\s*>/gi, '');
    out = out.replace(/<\/?\s*(script|style|iframe|object|embed|applet|form|link|meta|base|noscript|frame|frameset)\b[^>]*>/gi, '');
    out = out.replace(/[\s/"']on[a-z]+\s*=\s*"[^"]*"/gi, '');
    out = out.replace(/[\s/"']on[a-z]+\s*=\s*'[^']*'/gi, '');
    out = out.replace(/[\s/"']on[a-z]+\s*=\s*[^\s>]+/gi, '');
    out = neutralizeUrls(out);
    if (out === prev) break;
  }
  return out;
}

function neutralizeUrls(html: string): string {
  return html.replace(
    /(href|src|xlink:href|background|action)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (m: string, attr: string, dq: string, sq: string, bare: string) => {
      const val = dq ?? sq ?? bare ?? '';
      if (!dangerousUrl(val)) return m;
      if (bare != null) return `${attr}=#`;
      if (sq != null) return `${attr}='#'`;
      return `${attr}="#"`;
    },
  );
}

function dangerousUrl(val: string): boolean {
  const decoded = val.replace(/&#(x?[0-9a-f]+);?/gi, (_m: string, n: string) => {
    const code = n[0] === 'x' || n[0] === 'X' ? parseInt(n.slice(1), 16) : parseInt(n, 10);
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
  let s = '';
  for (const ch of decoded) {
    const cp = ch.codePointAt(0) ?? 0;
    if (cp > 0x20) s += ch;
  }
  s = s.toLowerCase();
  return s.startsWith('javascript:') || s.startsWith('vbscript:') || s.startsWith('data:text/html');
}
