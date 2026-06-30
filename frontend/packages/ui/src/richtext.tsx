import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type ClipboardEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { cn } from './lib/cn';
import { Button, IconButton, Input } from './controls';
import { DropdownMenu, type MenuItem } from './overlay/menu';
import {
  AlignCenterIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  ChevronDownIcon,
  ClearFormatIcon,
  ImageIcon,
  IndentIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  MinusIcon,
  OutdentIcon,
  QuoteIcon,
  StrikethroughIcon,
  TableIcon,
  UnderlineIcon,
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
  const wrapRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selRef = useRef<Range | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const cellRef = useRef<HTMLTableCellElement | null>(null);
  const [handle, setHandle] = useState<{ left: number; top: number } | null>(null);
  const [inTable, setInTable] = useState(false);
  const [blockTag, setBlockTag] = useState('P');
  const [empty, setEmpty] = useState(() => htmlIsBlank(defaultValue));
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [bar, setBar] = useState<'none' | 'link' | 'table'>('none');
  const [linkUrl, setLinkUrl] = useState('');
  const [rows, setRows] = useState(2);
  const [cols, setCols] = useState(2);

  // Load (and reload on resetKey) the initial content. Uncontrolled afterwards so the caret never
  // jumps mid-typing.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = sanitizeFragment(defaultValue);
    setEmpty(htmlIsBlank(defaultValue));
    imgRef.current = null;
    setHandle(null);
    cellRef.current = null;
    setInTable(false);
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

  // Preserve the editor selection across toolbar interactions: opening a colour picker or a menu
  // blurs the editable area, which would otherwise drop the caret so the command applies to nothing.
  function saveSel() {
    if (typeof window === 'undefined') return;
    const s = window.getSelection();
    if (s && s.rangeCount && ref.current && ref.current.contains(s.anchorNode)) {
      selRef.current = s.getRangeAt(0).cloneRange();
    }
  }
  function restoreSel() {
    if (typeof window === 'undefined') return;
    const s = window.getSelection();
    if (selRef.current && s) {
      s.removeAllRanges();
      s.addRange(selRef.current);
    }
  }

  function onSelectionActivity() {
    saveSel();
    refreshActive();
    const cell = cellAncestor();
    cellRef.current = cell;
    setInTable(!!cell);
  }

  // ── table editing (change the number of rows/columns of an existing table) ──────────
  function cellAncestor(): HTMLTableCellElement | null {
    if (typeof window === 'undefined') return null;
    const sel = window.getSelection();
    let n: Node | null = sel?.anchorNode ?? null;
    while (n && n !== ref.current) {
      if (n.nodeType === 1) {
        const tag = (n as HTMLElement).tagName;
        if (tag === 'TD' || tag === 'TH') return n as HTMLTableCellElement;
      }
      n = n.parentNode;
    }
    return null;
  }

  function styleCell(td: HTMLTableCellElement) {
    td.setAttribute('style', 'border:1px solid #cfcfcf;padding:6px 8px;min-width:2.5em');
    td.innerHTML = '<br>';
  }

  // withCell runs an operation against the caret's current cell/row/table, then re-emits.
  function withCell(fn: (cell: HTMLTableCellElement, row: HTMLTableRowElement, table: HTMLTableElement) => void) {
    const cell = cellRef.current;
    const row = cell?.parentElement as HTMLTableRowElement | null;
    const table = cell?.closest('table') as HTMLTableElement | null;
    if (!cell || !row || !table || !ref.current?.contains(table)) return;
    fn(cell, row, table);
    emit();
  }

  function addRow(below: boolean) {
    withCell((_cell, row, table) => {
      const tr = table.insertRow(row.rowIndex + (below ? 1 : 0));
      for (let i = 0; i < row.cells.length; i++) styleCell(tr.insertCell());
    });
  }

  function addColumn(after: boolean) {
    withCell((cell, _row, table) => {
      const idx = cell.cellIndex + (after ? 1 : 0);
      for (const r of Array.from(table.rows)) styleCell(r.insertCell(Math.min(idx, r.cells.length)));
    });
  }

  function removeRow() {
    withCell((_cell, row, table) => {
      if (table.rows.length <= 1) removeTable(table);
      else table.deleteRow(row.rowIndex);
    });
  }

  function removeColumn() {
    withCell((cell, row, table) => {
      if (row.cells.length <= 1) {
        removeTable(table);
        return;
      }
      const idx = cell.cellIndex;
      for (const r of Array.from(table.rows)) if (idx < r.cells.length) r.deleteCell(idx);
    });
  }

  function removeTable(table?: HTMLTableElement) {
    const t = table ?? cellRef.current?.closest('table') ?? null;
    if (t && t.parentNode) t.parentNode.removeChild(t);
    cellRef.current = null;
    setInTable(false);
    emit();
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
      justifyLeft: q('justifyLeft'),
      justifyCenter: q('justifyCenter'),
      justifyRight: q('justifyRight'),
      quote: !!blockquoteAncestor(),
    });
    setBlockTag(currentBlockTag());
  }

  function exec(command: string, value?: string) {
    if (typeof document === 'undefined') return;
    ref.current?.focus();
    restoreSel();
    try {
      document.execCommand(command, false, value);
    } catch {
      /* unsupported command — ignore */
    }
    emit();
    refreshActive();
  }

  // styled applies a colour/size command as INLINE CSS (styleWithCSS) so it survives in the sent
  // mail (email clients honour inline styles, not a stripped <style> block).
  function styled(command: string, value: string) {
    if (typeof document === 'undefined') return;
    ref.current?.focus();
    restoreSel();
    try {
      document.execCommand('styleWithCSS', false, 'true');
      document.execCommand(command, false, value);
      document.execCommand('styleWithCSS', false, 'false');
    } catch {
      /* ignore */
    }
    emit();
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

  // ── image resize ──────────────────────────────────────────────────────────────────
  // Position the drag handle over the selected image's bottom-right corner (getBoundingClientRect
  // is viewport-relative, so it already accounts for the editor's scroll position).
  function positionHandle() {
    const img = imgRef.current;
    const wrap = wrapRef.current;
    if (!img || !wrap || !ref.current || !ref.current.contains(img)) {
      imgRef.current = null;
      setHandle(null);
      return;
    }
    const ir = img.getBoundingClientRect();
    const wr = wrap.getBoundingClientRect();
    setHandle({ left: ir.right - wr.left, top: ir.bottom - wr.top });
  }

  function onEditorClick(e: { target: EventTarget | null }) {
    const t = e.target as HTMLElement;
    if (t && t.tagName === 'IMG') {
      imgRef.current = t as HTMLImageElement;
      positionHandle();
    } else {
      imgRef.current = null;
      setHandle(null);
    }
  }

  function onHandleDown(e: ReactPointerEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    const img = imgRef.current;
    if (!img) return;
    const startX = e.clientX;
    const startW = img.getBoundingClientRect().width;
    const maxW = (ref.current?.clientWidth ?? 1200) - 8;
    const onMove = (ev: PointerEvent) => {
      let w = Math.round(startW + (ev.clientX - startX));
      w = Math.max(40, Math.min(w, maxW));
      img.removeAttribute('width');
      img.removeAttribute('height');
      img.style.width = `${w}px`;
      img.style.height = 'auto';
      positionHandle();
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      emit();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }

  // ── quote toggle ──────────────────────────────────────────────────────────────────
  function blockquoteAncestor(): HTMLElement | null {
    if (typeof window === 'undefined') return null;
    const sel = window.getSelection();
    let n: Node | null = sel?.anchorNode ?? null;
    while (n && n !== ref.current) {
      if (n.nodeType === 1 && (n as HTMLElement).tagName === 'BLOCKQUOTE') return n as HTMLElement;
      n = n.parentNode;
    }
    return null;
  }

  // toggleQuote wraps the block in a <blockquote>, or unwraps it when the caret is already inside
  // one (un-quote), moving the quoted content back out to its parent.
  function unwrapBlockquote(bq: HTMLElement) {
    const parent = bq.parentNode;
    if (!parent) return;
    const firstMoved = bq.firstChild;
    while (bq.firstChild) parent.insertBefore(bq.firstChild, bq);
    parent.removeChild(bq);
    // Put the caret back into the unwrapped content so the next toggle reads the right context.
    const sel = window.getSelection();
    if (sel && firstMoved) {
      const r = document.createRange();
      r.setStart(firstMoved, 0);
      r.collapse(true);
      sel.removeAllRanges();
      sel.addRange(r);
    }
  }

  // toggleQuote (the Quote button) and setBlock (the Style menu) share one model so they stay in
  // sync: Quote toggles the blockquote; choosing a heading/normal un-quotes first, so a block is
  // either a quote OR a heading/normal, never a confusing mix.
  function toggleQuote() {
    if (typeof document === 'undefined') return;
    ref.current?.focus();
    const bq = blockquoteAncestor();
    if (bq) unwrapBlockquote(bq);
    else document.execCommand('formatBlock', false, 'BLOCKQUOTE');
    saveSel();
    emit();
    refreshActive();
  }

  function setBlock(tag: string) {
    if (typeof document === 'undefined') return;
    ref.current?.focus();
    const bq = blockquoteAncestor();
    if (bq) unwrapBlockquote(bq);
    document.execCommand('formatBlock', false, tag);
    saveSel();
    emit();
    refreshActive();
  }

  // clearFormatting strips ALL formatting from the selection: inline (bold/italic/colour/size/font),
  // links, list wrapping, the block format (headings/quote → normal paragraph) and alignment.
  function clearFormatting() {
    if (typeof document === 'undefined') return;
    ref.current?.focus();
    try {
      document.execCommand('removeFormat');
      document.execCommand('unlink');
      if (document.queryCommandState('insertUnorderedList')) document.execCommand('insertUnorderedList');
      if (document.queryCommandState('insertOrderedList')) document.execCommand('insertOrderedList');
    } catch {
      /* ignore */
    }
    const bq = blockquoteAncestor();
    if (bq) unwrapBlockquote(bq);
    try {
      document.execCommand('formatBlock', false, 'P');
      document.execCommand('justifyLeft');
    } catch {
      /* ignore */
    }
    saveSel();
    emit();
    refreshActive();
  }

  // currentBlockTag reports the block format at the caret for the Style menu; a blockquote wins over
  // any heading/normal it contains.
  function currentBlockTag(): string {
    if (blockquoteAncestor()) return 'BLOCKQUOTE';
    if (typeof window === 'undefined') return 'P';
    const sel = window.getSelection();
    let n: Node | null = sel?.anchorNode ?? null;
    while (n && n !== ref.current) {
      if (n.nodeType === 1) {
        const tag = (n as HTMLElement).tagName;
        if (tag === 'H1' || tag === 'H2' || tag === 'H3') return tag;
      }
      n = n.parentNode;
    }
    return 'P';
  }

  function openBar(which: 'link' | 'table') {
    saveSel();
    if (which === 'link') setLinkUrl('');
    setBar(which);
  }

  function applyLink() {
    let url = linkUrl.trim();
    if (url) {
      if (!/^(https?:|mailto:)/i.test(url)) url = 'https://' + url;
      ref.current?.focus();
      restoreSel();
      const sel = window.getSelection();
      if (sel && sel.isCollapsed) {
        document.execCommand('insertHTML', false, `<a href="${escapeAttr(url)}">${escapeText(url)}</a>`);
      } else {
        document.execCommand('createLink', false, url);
      }
      emit();
    }
    setBar('none');
    setLinkUrl('');
  }

  function chooseImage() {
    saveSel();
    fileRef.current?.click();
  }

  // Embed the picked image inline as a data: URL so the message is self-contained (no separate
  // attachment plumbing); the data: scheme is permitted by the viewer's CSP and the sanitisers.
  function onImageChosen(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const url = String(reader.result || '');
      if (!url) return;
      ref.current?.focus();
      restoreSel();
      try {
        document.execCommand('insertImage', false, url);
      } catch {
        /* ignore */
      }
      emit();
    };
    reader.readAsDataURL(f);
  }

  function insertTable() {
    const r = Math.max(1, Math.min(20, rows || 1));
    const c = Math.max(1, Math.min(10, cols || 1));
    const cell = '<td style="border:1px solid #cfcfcf;padding:6px 8px;min-width:2.5em">&#8203;</td>';
    let html = '<table style="border-collapse:collapse;margin:4px 0"><tbody>';
    for (let i = 0; i < r; i++) {
      html += '<tr>' + cell.repeat(c) + '</tr>';
    }
    html += '</tbody></table><p><br></p>';
    ref.current?.focus();
    restoreSel();
    try {
      document.execCommand('insertHTML', false, html);
    } catch {
      /* ignore */
    }
    emit();
    setBar('none');
  }

  const blockItems: MenuItem[] = [
    { id: 'p', label: 'Normal text', checked: blockTag === 'P', onSelect: () => setBlock('P') },
    { id: 'h1', label: 'Title', checked: blockTag === 'H1', onSelect: () => setBlock('H1') },
    { id: 'h2', label: 'Heading', checked: blockTag === 'H2', onSelect: () => setBlock('H2') },
    { id: 'h3', label: 'Subheading', checked: blockTag === 'H3', onSelect: () => setBlock('H3') },
    { id: 'quote', label: 'Quote', checked: blockTag === 'BLOCKQUOTE', onSelect: toggleQuote },
  ];
  const blockLabel = ({ P: 'Normal', H1: 'Title', H2: 'Heading', H3: 'Subheading', BLOCKQUOTE: 'Quote' } as Record<string, string>)[blockTag] ?? 'Normal';
  const sizeItems: MenuItem[] = [
    { id: 's', label: 'Small', onSelect: () => styled('fontSize', '2') },
    { id: 'n', label: 'Normal', onSelect: () => styled('fontSize', '3') },
    { id: 'l', label: 'Large', onSelect: () => styled('fontSize', '5') },
    { id: 'h', label: 'Huge', onSelect: () => styled('fontSize', '7') },
  ];

  return (
    <div className={cn('flex min-h-0 flex-col overflow-hidden rounded-lg border border-separator bg-surface', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-separator px-1.5 py-1">
        <DropdownMenu
          align="start"
          items={blockItems}
          trigger={
            <Button size="sm" variant="ghost" iconRight={<ChevronDownIcon />} onMouseDown={(e) => e.preventDefault()}>
              {blockLabel}
            </Button>
          }
        />
        <DropdownMenu
          align="start"
          items={sizeItems}
          trigger={
            <Button size="sm" variant="ghost" iconRight={<ChevronDownIcon />} onMouseDown={(e) => e.preventDefault()}>
              Size
            </Button>
          }
        />
        <Separator />
        <Tool icon={<BoldIcon />} label="Bold" active={active.bold} onClick={() => exec('bold')} />
        <Tool icon={<ItalicIcon />} label="Italic" active={active.italic} onClick={() => exec('italic')} />
        <Tool icon={<UnderlineIcon />} label="Underline" active={active.underline} onClick={() => exec('underline')} />
        <Tool icon={<StrikethroughIcon />} label="Strikethrough" active={active.strikeThrough} onClick={() => exec('strikeThrough')} />
        <Separator />
        <Swatch title="Text colour" defaultValue="#111111" onPick={(v) => styled('foreColor', v)} onOpen={saveSel} />
        <Swatch title="Highlight colour" defaultValue="#ffe14d" onPick={(v) => styled('hiliteColor', v)} onOpen={saveSel} />
        <Separator />
        <Tool icon={<ListIcon />} label="Bulleted list" active={active.insertUnorderedList} onClick={() => exec('insertUnorderedList')} />
        <Tool icon={<ListOrderedIcon />} label="Numbered list" active={active.insertOrderedList} onClick={() => exec('insertOrderedList')} />
        <Tool icon={<OutdentIcon />} label="Decrease indent" onClick={() => exec('outdent')} />
        <Tool icon={<IndentIcon />} label="Increase indent" onClick={() => exec('indent')} />
        <Separator />
        <Tool icon={<AlignLeftIcon />} label="Align left" active={active.justifyLeft} onClick={() => exec('justifyLeft')} />
        <Tool icon={<AlignCenterIcon />} label="Align centre" active={active.justifyCenter} onClick={() => exec('justifyCenter')} />
        <Tool icon={<AlignRightIcon />} label="Align right" active={active.justifyRight} onClick={() => exec('justifyRight')} />
        <Separator />
        <Tool icon={<QuoteIcon />} label="Quote" active={active.quote} onClick={toggleQuote} />
        <Tool icon={<LinkIcon />} label="Insert link" active={bar === 'link'} onClick={() => openBar('link')} />
        <Tool icon={<ImageIcon />} label="Insert image" onClick={chooseImage} />
        <Tool icon={<TableIcon />} label="Insert table" active={bar === 'table'} onClick={() => openBar('table')} />
        <Tool icon={<MinusIcon />} label="Horizontal line" onClick={() => exec('insertHorizontalRule')} />
        <Tool icon={<ClearFormatIcon />} label="Clear formatting" onClick={clearFormatting} />
      </div>

      {bar === 'link' && (
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
                setBar('none');
              }
            }}
            className="h-8 flex-1"
          />
          <Button size="sm" variant="primary" onMouseDown={(e) => e.preventDefault()} onClick={applyLink}>
            Add link
          </Button>
          <Button size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => setBar('none')}>
            Cancel
          </Button>
        </div>
      )}

      {bar === 'table' && (
        <div className="flex items-center gap-2 border-b border-separator px-2 py-1.5 text-footnote text-text-secondary">
          <span>Rows</span>
          <Input
            type="number"
            min={1}
            max={20}
            value={String(rows)}
            onChange={(e) => setRows(Number(e.target.value))}
            className="h-8 w-16"
          />
          <span>Columns</span>
          <Input
            type="number"
            min={1}
            max={10}
            value={String(cols)}
            onChange={(e) => setCols(Number(e.target.value))}
            className="h-8 w-16"
          />
          <Button size="sm" variant="primary" onMouseDown={(e) => e.preventDefault()} onClick={insertTable}>
            Insert table
          </Button>
          <Button size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={() => setBar('none')}>
            Cancel
          </Button>
        </div>
      )}

      {inTable && (
        <div className="flex flex-wrap items-center gap-1 border-b border-separator bg-fill/5 px-2 py-1">
          <span className="px-1 text-footnote font-medium text-text-secondary">Table</span>
          <TableBtn onClick={() => addRow(false)}>+ Row above</TableBtn>
          <TableBtn onClick={() => addRow(true)}>+ Row below</TableBtn>
          <TableBtn onClick={removeRow}>− Row</TableBtn>
          <Separator />
          <TableBtn onClick={() => addColumn(false)}>+ Col left</TableBtn>
          <TableBtn onClick={() => addColumn(true)}>+ Col right</TableBtn>
          <TableBtn onClick={removeColumn}>− Col</TableBtn>
          <Separator />
          <TableBtn onClick={() => removeTable()}>Delete table</TableBtn>
        </div>
      )}

      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onImageChosen} />

      <div ref={wrapRef} className="relative min-h-0 flex-1">
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          aria-label={ariaLabel}
          spellCheck
          onInput={() => {
            emit();
            if (imgRef.current) {
              imgRef.current = null;
              setHandle(null);
            }
          }}
          onBlur={emit}
          onPaste={onPaste}
          onClick={onEditorClick}
          onScroll={() => imgRef.current && positionHandle()}
          onKeyUp={onSelectionActivity}
          onMouseUp={onSelectionActivity}
          onFocus={onSelectionActivity}
          className="holistic-rte h-full overflow-auto px-3 py-2 text-body leading-relaxed text-text-primary outline-none"
          style={{ minHeight, maxHeight }}
        />
        {empty && (
          <div className="pointer-events-none absolute left-3 top-2 select-none text-body text-text-tertiary">{placeholder}</div>
        )}
        {handle && (
          <div
            onPointerDown={onHandleDown}
            className="absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 cursor-nwse-resize rounded-sm border border-white bg-accent shadow-elev-1"
            style={{ left: handle.left, top: handle.top }}
            aria-hidden="true"
          />
        )}
      </div>
    </div>
  );
}

// Swatch is a colour-picker toolbar control. It saves the editor selection on open, then applies
// the chosen colour as an inline style when the value changes.
function Swatch({ title, defaultValue, onPick, onOpen }: { title: string; defaultValue: string; onPick: (v: string) => void; onOpen: () => void }) {
  return (
    <label className="relative inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded hover:bg-fill/10" title={title}>
      <input
        type="color"
        aria-label={title}
        defaultValue={defaultValue}
        onMouseDown={onOpen}
        onChange={(e) => onPick(e.target.value)}
        className="h-5 w-5 cursor-pointer appearance-none border-0 bg-transparent p-0"
      />
    </label>
  );
}

function Separator() {
  return <div className="mx-1 h-5 w-px bg-separator" aria-hidden="true" />;
}

function TableBtn({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <Button size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={onClick}>
      {children}
    </Button>
  );
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
