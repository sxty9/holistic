import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from './lib/cn';
import { Tooltip } from './overlay/tooltip';

export interface MarqueeProps {
  /** Full text; continuously scrolls when it overflows and shows in a tooltip on hover. */
  text: string;
  className?: string;
  /** Scroll speed in px/sec. */
  speed?: number;
  /** Gap (px) between the repeated copies of the text in the seamless loop. */
  gap?: number;
}

/** Single-line text that, when it overflows its box, glides continuously to reveal the
 *  whole string (seamless ticker, paused on hover) and exposes the full text in a
 *  tooltip. A no-op — plain truncating text — when it already fits. */
export function Marquee({ text, className, speed = 40, gap = 48 }: MarqueeProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const hovered = useRef(false);
  const [overflow, setOverflow] = useState(false);
  const [segW, setSegW] = useState(0);

  // Measure the single-copy width vs the box; re-measure on resize. useLayoutEffect runs
  // before paint, so the overflow decision is settled without a visible flash.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const m = measureRef.current;
    if (!box || !m) return;
    const update = () => {
      const tw = m.scrollWidth;
      setOverflow(tw - box.clientWidth > 1);
      setSegW(tw + gap);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(box);
    ro.observe(m);
    return () => ro.disconnect();
  }, [text, gap]);

  // Seamless leftward scroll over exactly one segment width (text + gap): when the first
  // copy has fully scrolled off, the second copy sits where the first began, so the loop
  // is invisible. Paused while hovered (a ref keeps that across resize-driven rebuilds).
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track || !overflow || segW <= 0) return;
    const anim = track.animate(
      [{ transform: 'translateX(0)' }, { transform: `translateX(${-segW}px)` }],
      { duration: (segW / speed) * 1000, iterations: Infinity, easing: 'linear' },
    );
    if (hovered.current) anim.pause();
    const box = boxRef.current;
    const pause = () => {
      hovered.current = true;
      anim.pause();
    };
    const play = () => {
      hovered.current = false;
      anim.play();
    };
    box?.addEventListener('mouseenter', pause);
    box?.addEventListener('mouseleave', play);
    return () => {
      anim.cancel();
      box?.removeEventListener('mouseenter', pause);
      box?.removeEventListener('mouseleave', play);
    };
  }, [overflow, segW, speed]);

  return (
    <Tooltip content={text} disabled={!overflow}>
      <div ref={boxRef} className={cn('relative overflow-hidden', className)}>
        {/* Hidden single-copy measurer (no layout impact). */}
        <span ref={measureRef} className="invisible absolute whitespace-nowrap" aria-hidden>
          {text}
        </span>
        {overflow ? (
          <div ref={trackRef} className="inline-flex w-max whitespace-nowrap will-change-transform">
            <span style={{ paddingRight: gap }}>{text}</span>
            <span style={{ paddingRight: gap }} aria-hidden>
              {text}
            </span>
          </div>
        ) : (
          <span className="block truncate">{text}</span>
        )}
      </div>
    </Tooltip>
  );
}
