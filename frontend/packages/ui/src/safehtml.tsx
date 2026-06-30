import { useEffect, useMemo, useState } from 'react';
import { cn } from './lib/cn';
import { Button } from './controls';

export interface SafeHtmlEmailProps {
  /** Raw HTML body of an email. Rendered inside a sandboxed, script-free iframe. */
  html: string;
  /** Max viewport height in px; taller content scrolls within the frame. Default 640. */
  maxHeight?: number;
  /** Fill the parent's height instead of using a fixed maxHeight (the parent must be sized). */
  fill?: boolean;
  className?: string;
  /** Accessible title for the iframe. */
  title?: string;
  /** Copy for the privacy banner shown while remote images are blocked. */
  imagesBlockedLabel?: string;
  /** Copy for the "load remote images" button. */
  showImagesLabel?: string;
}

type Scheme = 'light' | 'dark';

// palette is the per-theme set of defaults injected into the iframe document. Only the html/body
// defaults are set (never forced on every element), so an email that ships its own colors —
// newsletters, designed templates — keeps them, while plain/simple mail adapts to the app theme.
const palette: Record<Scheme, { bg: string; fg: string; link: string; quote: string; rule: string }> = {
  light: { bg: '#ffffff', fg: '#1d1d1f', link: '#0a84ff', quote: '#6e6e73', rule: '#d2d2d7' },
  dark: { bg: '#1c1c1e', fg: 'rgba(255,255,255,0.96)', link: '#3d9bff', quote: 'rgba(235,235,245,0.6)', rule: 'rgba(255,255,255,0.16)' },
};

// useResolvedTheme tracks the app's current theme by observing the `data-theme` attribute the
// shell sets on <html> (falling back to the OS preference), and re-renders on every change so the
// email recolors live when the user toggles light/dark.
function useResolvedTheme(): Scheme {
  const read = (): Scheme => {
    if (typeof document === 'undefined') return 'light';
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr === 'light' || attr === 'dark') return attr;
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  };
  const [scheme, setScheme] = useState<Scheme>(read);
  useEffect(() => {
    const update = () => setScheme(read());
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    return () => {
      mo.disconnect();
      mq.removeEventListener('change', update);
    };
  }, []);
  return scheme;
}

/**
 * SafeHtmlEmail renders untrusted HTML email bodies safely. The HTML is shown inside an iframe
 * whose `sandbox` grants NO script and NO same-origin access, so nothing in the message can run
 * JavaScript, reach the parent page, read cookies, or navigate the app — the sandbox is the
 * primary control. A strict Content-Security-Policy inside the frame is the second layer: it
 * blocks every external load except images, and even those are denied until the reader opts in
 * (defeating tracking pixels). A lightweight pre-sanitiser strips scripts/handlers as belt and
 * braces. The frame is theme-aware: it adapts its default background/text to the app's light/dark
 * theme while leaving an email's own colors intact. This is the ONE place in the design allowed to
 * render email HTML; service UIs must use it rather than dangerouslySetInnerHTML.
 */
export function SafeHtmlEmail({
  html,
  maxHeight = 640,
  fill = false,
  className,
  title = 'Email content',
  imagesBlockedLabel = 'Remote images are blocked to protect your privacy.',
  showImagesLabel = 'Show images',
}: SafeHtmlEmailProps) {
  const [showImages, setShowImages] = useState(false);
  const scheme = useResolvedTheme();
  const hasRemoteImages = useMemo(() => /<img\b[^>]*\bsrc\s*=\s*["']?\s*https?:/i.test(html), [html]);
  // If the email brings its own background (a designed/newsletter template), render it in LIGHT even
  // in dark mode: forcing our dark text over the sender's light background would make it invisible
  // (white-on-white). Plain mail with no background of its own follows the app theme — the common
  // case that was flashing white before.
  const ownsBackground = useMemo(() => /\bbgcolor\s*=|\bbackground(?:-color)?\s*:\s*[^;"'>]*\S/i.test(html), [html]);
  const effectiveScheme: Scheme = scheme === 'dark' && ownsBackground ? 'light' : scheme;
  const srcDoc = useMemo(() => buildDocument(html, showImages, effectiveScheme), [html, showImages, effectiveScheme]);

  if (!html.trim()) return null;

  return (
    <div className={cn('flex flex-col gap-2', fill && 'h-full min-h-0', className)}>
      {hasRemoteImages && !showImages && (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-separator bg-fill/5 px-3 py-2">
          <span className="text-footnote text-text-secondary">{imagesBlockedLabel}</span>
          <Button variant="tinted" size="sm" onClick={() => setShowImages(true)}>
            {showImagesLabel}
          </Button>
        </div>
      )}
      <iframe
        title={title}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        srcDoc={srcDoc}
        referrerPolicy="no-referrer"
        className={cn('w-full rounded-lg border border-separator', fill && 'min-h-0 flex-1')}
        style={{ height: fill ? undefined : maxHeight, background: palette[effectiveScheme].bg, colorScheme: effectiveScheme }}
      />
    </div>
  );
}

/** Wrap sanitised email HTML in a minimal, locked-down, theme-aware document for the iframe. */
function buildDocument(html: string, showImages: boolean, scheme: Scheme): string {
  const c = palette[scheme];
  const imgSrc = showImages ? 'https: http: data:' : 'data:';
  // default-src 'none' denies scripts, frames, objects, connections, fonts(except data:) and
  // anything not explicitly allowed; the iframe sandbox already blocks script execution outright.
  const csp = [
    "default-src 'none'",
    "style-src 'unsafe-inline'",
    `img-src ${imgSrc}`,
    'font-src data:',
    'media-src data:',
    "form-action 'none'",
    "base-uri 'none'",
  ].join('; ');
  return (
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta http-equiv="Content-Security-Policy" content="${csp}">` +
    `<meta name="color-scheme" content="${scheme}">` +
    `<base target="_blank">` +
    `<style>:root{color-scheme:${scheme}}html,body{margin:0;padding:12px;background:${c.bg};color:${c.fg};` +
    `font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;` +
    `word-break:break-word;overflow-wrap:anywhere}` +
    `img{max-width:100%;height:auto}a{color:${c.link}}` +
    `table{max-width:100%}blockquote{margin:0 0 0 12px;padding-left:12px;border-left:3px solid ${c.rule};color:${c.quote}}</style>` +
    `</head><body>${sanitizeEmailHtml(html)}</body></html>`
  );
}

/**
 * sanitizeEmailHtml is defence-in-depth (the sandbox + CSP already neutralise active content). It
 * removes script-bearing or document-structure elements, inline event handlers, and dangerous URL
 * schemes, while keeping <style> and inline styles so formatted mail still renders faithfully.
 */
function sanitizeEmailHtml(html: string): string {
  let out = html;
  // Drop conditional/hidden comments (can smuggle markup) and dangerous container elements.
  out = out.replace(/<!--[\s\S]*?-->/g, '');
  out = out.replace(/<(script|iframe|object|embed|applet|form|link|meta|base|noscript|frame|frameset)\b[\s\S]*?<\/\1\s*>/gi, '');
  out = out.replace(/<(script|iframe|object|embed|applet|form|link|meta|base|noscript|frame|frameset)\b[^>]*\/?>/gi, '');
  // Strip inline event handlers (on*) in either quote style or unquoted.
  out = out.replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '');
  out = out.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, '');
  // Neutralise javascript:/vbscript:/inline-html data URLs in link and source attributes.
  out = out.replace(/(href|src|xlink:href|background|action)\s*=\s*"(\s*(?:javascript|vbscript|data:text\/html)[^"]*)"/gi, '$1="#"');
  out = out.replace(/(href|src|xlink:href|background|action)\s*=\s*'(\s*(?:javascript|vbscript|data:text\/html)[^']*)'/gi, "$1='#'");
  return out;
}
