import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../lib/cn';

export interface HoverPanelProps {
  /** Hover trigger (e.g. a table column header label). */
  children: ReactNode;
  /** Floating content, kept open while the pointer is over the trigger OR the panel.
   *  Pass a function to build it lazily — it is only evaluated while the panel is open. */
  panel: ReactNode | (() => ReactNode);
  className?: string;
  panelClassName?: string;
  width?: number;
  /** Render the trigger as a full-width block (to wrap cards/rows) instead of inline. */
  block?: boolean;
}

/** A hover-activated floating panel that persists while the pointer is over the
 *  trigger or the panel, and dismisses shortly after the pointer leaves both. It
 *  renders in a portal with fixed positioning so table/overflow clipping can't cut
 *  it off, and re-anchors on scroll/resize. */
export function HoverPanel({ children, panel, className, panelClassName, width = 340, block }: HoverPanelProps) {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimer = useRef<number | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const place = () => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8));
    // Flush against the trigger (no positional gap) so the pointer never crosses a
    // dead zone between trigger and panel; visual spacing comes from the panel padding.
    setPos({ top: r.bottom, left });
  };

  const show = () => {
    window.clearTimeout(closeTimer.current);
    place();
    setOpen(true);
  };
  const hide = () => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const reanchor = () => place();
    window.addEventListener('scroll', reanchor, true);
    window.addEventListener('resize', reanchor);
    return () => {
      window.removeEventListener('scroll', reanchor, true);
      window.removeEventListener('resize', reanchor);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      <span ref={triggerRef} className={cn(block ? 'block w-full' : 'inline-flex', className)} onMouseEnter={show} onMouseLeave={hide}>
        {children}
      </span>
      {open &&
        createPortal(
          <div
            style={{ position: 'fixed', top: pos.top, left: pos.left, width }}
            className={cn(
              'z-50 rounded-md border border-separator bg-material-thick [backdrop-filter:var(--material-blur)] p-3 shadow-elev-3 animate-pop-in',
              panelClassName,
            )}
            onMouseEnter={show}
            onMouseLeave={hide}
          >
            {typeof panel === 'function' ? (panel as () => ReactNode)() : panel}
          </div>,
          document.body,
        )}
    </>
  );
}
