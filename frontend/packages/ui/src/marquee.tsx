import { useLayoutEffect, useRef, useState } from 'react';
import { cn } from './lib/cn';
import { Tooltip } from './overlay/tooltip';

export interface MarqueeProps {
  /** Full text; auto-scrolls when it overflows and shows in a tooltip on hover. */
  text: string;
  className?: string;
  /** Scroll speed in px/sec while overflowing. */
  speed?: number;
}

/** Single-line text that ping-pong auto-scrolls when it overflows its box (paused
 *  on hover) and reveals the full text in a tooltip. A no-op when the text fits. */
export function Marquee({ text, className, speed = 28 }: MarqueeProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const hovered = useRef(false);
  const [overflow, setOverflow] = useState(0);

  // Measure overflow synchronously (avoids a layout flash) and on resize.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    const measure = () => setOverflow(Math.max(0, inner.scrollWidth - box.clientWidth));
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(box);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [text]);

  // Drive the scroll with the Web Animations API — distance/duration scale with the
  // overflow, and it pauses while hovered so the value stays readable.
  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return;
    if (overflow <= 1) {
      inner.style.transform = '';
      return;
    }
    const travel = (overflow / speed) * 1000;
    const anim = inner.animate(
      [
        { transform: 'translateX(0)', offset: 0 },
        { transform: 'translateX(0)', offset: 0.12 },
        { transform: `translateX(${-overflow}px)`, offset: 0.5 },
        { transform: `translateX(${-overflow}px)`, offset: 0.62 },
        { transform: 'translateX(0)', offset: 1 },
      ],
      { duration: travel * 2 + 2400, iterations: Infinity, easing: 'ease-in-out' },
    );
    const pause = () => {
      hovered.current = true;
      anim.pause();
    };
    const play = () => {
      hovered.current = false;
      anim.play();
    };
    box.addEventListener('mouseenter', pause);
    box.addEventListener('mouseleave', play);
    // Survive effect re-runs (resize/text change): if the pointer is already inside
    // the box, keep the freshly created animation paused so the text stays readable.
    if (hovered.current) anim.pause();
    return () => {
      anim.cancel();
      box.removeEventListener('mouseenter', pause);
      box.removeEventListener('mouseleave', play);
    };
  }, [overflow, speed]);

  return (
    <Tooltip content={text} disabled={overflow <= 1}>
      <div ref={boxRef} className={cn('overflow-hidden whitespace-nowrap', className)}>
        <span ref={innerRef} className="inline-block will-change-transform">
          {text}
        </span>
      </div>
    </Tooltip>
  );
}
