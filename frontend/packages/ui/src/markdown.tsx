// Markdown — a dependency-light Markdown + math renderer for the design system.
//
// AI assistants (and other services) emit Markdown with LaTeX math; this turns it into
// styled React elements. It is XSS-safe by construction: every piece of model text becomes
// a React text node (auto-escaped) — the ONLY injected HTML is KaTeX's own output, produced
// locally from the math source by the katex library (a fixed, trusted renderer). That is why
// no HTML sanitizer is needed. KaTeX ships its stylesheet, imported once here.
//
// Supported: headings, paragraphs, ordered/unordered lists, blockquotes, fenced code, pipe
// tables, horizontal rules, and inline **bold**, *italic*, ~~strike~~, `code`, [links](url),
// $inline$ / \(inline\) math and $$display$$ / \[display\] math blocks.
import { useMemo, type ReactNode } from 'react';
import katex from 'katex';
import 'katex/dist/katex.min.css';
import { cn } from './lib/cn';

export interface MarkdownProps {
  /** The Markdown source to render. */
  text: string;
  className?: string;
}

/** Markdown renders Markdown + LaTeX math as styled, escaped React elements. */
export function Markdown({ text, className }: MarkdownProps) {
  const blocks = useMemo(() => parseBlocks(text ?? ''), [text]);
  return <div className={cn('space-y-2 text-body text-text-primary', className)}>{blocks}</div>;
}

// ── math ──────────────────────────────────────────────────────────────────────
function mathNode(tex: string, display: boolean, key: string): ReactNode {
  let html: string;
  try {
    html = katex.renderToString(tex.trim(), { throwOnError: false, displayMode: display });
  } catch {
    return <span key={key} className="font-mono">{tex}</span>;
  }
  return display ? (
    <div key={key} className="my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: html }} />
  ) : (
    <span key={key} dangerouslySetInnerHTML={{ __html: html }} />
  );
}

// ── inline ────────────────────────────────────────────────────────────────────
// Leftmost-match scan over the inline grammar. Order inside the alternation only breaks ties
// at the SAME position (regex picks the leftmost match regardless of alternative order).
const INLINE =
  /(\$\$[^$]+?\$\$|\$(?=\S)[^$\n]+?(?<=\S)\$|\\\([\s\S]+?\\\)|`[^`]+`|\*\*[\s\S]+?\*\*|__[\s\S]+?__|~~[\s\S]+?~~|\*(?=\S)[^*\n]+?(?<=\S)\*|_(?=\S)[^_\n]+?(?<=\S)_|\[[^\]]+\]\([^)\s]+\))/;

function inlineNodes(input: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  let rest = input;
  let n = 0;
  while (rest) {
    const m = INLINE.exec(rest);
    if (!m || m.index === undefined) {
      out.push(rest);
      break;
    }
    if (m.index > 0) out.push(rest.slice(0, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${n++}`;
    out.push(renderToken(tok, key));
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

function renderToken(tok: string, key: string): ReactNode {
  if (tok.startsWith('$$') && tok.endsWith('$$')) return mathNode(tok.slice(2, -2), false, key);
  if (tok.startsWith('$')) return mathNode(tok.slice(1, -1), false, key);
  if (tok.startsWith('\\(')) return mathNode(tok.slice(2, -2), false, key);
  if (tok.startsWith('`')) {
    return (
      <code key={key} className="font-mono text-footnote bg-fill/10 rounded-sm px-1 py-0.5">
        {tok.slice(1, -1)}
      </code>
    );
  }
  if (tok.startsWith('**') || tok.startsWith('__')) {
    return <strong key={key} className="font-semibold">{inlineNodes(tok.slice(2, -2), key)}</strong>;
  }
  if (tok.startsWith('~~')) {
    return <span key={key} className="line-through opacity-70">{inlineNodes(tok.slice(2, -2), key)}</span>;
  }
  if (tok.startsWith('*') || tok.startsWith('_')) {
    return <em key={key}>{inlineNodes(tok.slice(1, -1), key)}</em>;
  }
  if (tok.startsWith('[')) {
    const m = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok);
    if (m) {
      return (
        <a key={key} href={m[2]} target="_blank" rel="noopener noreferrer" className="text-accent underline">
          {inlineNodes(m[1], key)}
        </a>
      );
    }
  }
  return tok;
}

// ── blocks ────────────────────────────────────────────────────────────────────
function parseBlocks(text: string): ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const out: ReactNode[] = [];
  let i = 0;
  let k = 0;
  const key = () => `b${k++}`;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Fenced code block.
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) body.push(lines[i++]);
      i++; // closing fence
      out.push(
        <pre key={key()} className="font-mono text-footnote bg-fill/5 rounded-md p-3 overflow-x-auto">
          <code>{body.join('\n')}</code>
        </pre>,
      );
      continue;
    }

    // Display math block: $$ … $$ or \[ … \] (possibly on one line).
    const mOpen = line.trim();
    if (mOpen === '$$' || mOpen === '\\[' || mOpen.startsWith('$$') || mOpen.startsWith('\\[')) {
      const close = mOpen.startsWith('\\[') ? '\\]' : '$$';
      const openTok = mOpen.startsWith('\\[') ? '\\[' : '$$';
      let inner = mOpen.slice(openTok.length);
      if (inner.endsWith(close) && inner.length >= close.length && mOpen.length > openTok.length) {
        inner = inner.slice(0, -close.length);
        out.push(mathNode(inner, true, key()));
        i++;
        continue;
      }
      // Multi-line: collect until the closing delimiter.
      const body: string[] = inner ? [inner] : [];
      i++;
      while (i < lines.length && !lines[i].trim().endsWith(close)) body.push(lines[i++]);
      if (i < lines.length) {
        const last = lines[i].trim();
        body.push(last.slice(0, last.length - close.length));
        i++;
      }
      out.push(mathNode(body.join('\n'), true, key()));
      continue;
    }

    // Heading.
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = level <= 2 ? 'text-subhead font-semibold' : 'text-body font-semibold';
      out.push(
        <div key={key()} className={cn(cls, 'text-text-primary', level <= 2 ? 'mt-1' : '')}>
          {inlineNodes(h[2], key())}
        </div>,
      );
      i++;
      continue;
    }

    // Horizontal rule.
    if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      out.push(<div key={key()} className="border-t border-separator my-2" />);
      i++;
      continue;
    }

    // Blockquote.
    if (/^>\s?/.test(line)) {
      const body: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) body.push(lines[i++].replace(/^>\s?/, ''));
      out.push(
        <blockquote key={key()} className="border-l-2 border-separator pl-3 text-text-secondary">
          {inlineNodes(body.join(' '), key())}
        </blockquote>,
      );
      continue;
    }

    // Pipe table: header row + separator row of dashes.
    if (line.includes('|') && i + 1 < lines.length && /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/.test(lines[i + 1]) && lines[i + 1].includes('-')) {
      const header = splitRow(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].includes('|') && lines[i].trim()) rows.push(splitRow(lines[i++]));
      out.push(
        <div key={key()} className="overflow-x-auto">
          <table className="text-footnote border-collapse">
            <thead>
              <tr>
                {header.map((c, ci) => (
                  <th key={ci} className="border border-separator px-2 py-1 text-left font-semibold">
                    {inlineNodes(c, `${key()}h${ci}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci} className="border border-separator px-2 py-1 align-top">
                      {inlineNodes(c, `${key()}r${ri}c${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // Lists (single level; ordered vs unordered by the first marker).
    if (/^\s*([-*+])\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      const re = ordered ? /^\s*\d+\.\s+(.*)$/ : /^\s*[-*+]\s+(.*)$/;
      while (i < lines.length) {
        const m = lines[i].match(re);
        if (m) {
          items.push(m[1]);
          i++;
        } else if (lines[i].trim() && /^\s{2,}/.test(lines[i]) && items.length) {
          // continuation line of the previous item
          items[items.length - 1] += ' ' + lines[i].trim();
          i++;
        } else break;
      }
      const ListTag = ordered ? 'ol' : 'ul';
      out.push(
        <ListTag key={key()} className={cn(ordered ? 'list-decimal' : 'list-disc', 'pl-5 space-y-1')}>
          {items.map((it, idx) => (
            <li key={idx}>{inlineNodes(it, `${key()}i${idx}`)}</li>
          ))}
        </ListTag>,
      );
      continue;
    }

    // Paragraph: gather until a blank line or a block starter.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++]);
    out.push(
      <p key={key()} className="leading-relaxed">
        {inlineNodes(para.join(' '), key())}
      </p>,
    );
  }

  return out;
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((c) => c.trim());
}

function isBlockStart(line: string): boolean {
  return (
    /^```/.test(line) ||
    /^(#{1,6})\s/.test(line) ||
    /^>\s?/.test(line) ||
    /^\s*([-*+])\s+/.test(line) ||
    /^\s*\d+\.\s+/.test(line) ||
    /^(-{3,}|\*{3,}|_{3,})\s*$/.test(line) ||
    line.trim() === '$$' ||
    line.trim().startsWith('\\[')
  );
}
