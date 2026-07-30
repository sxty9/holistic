import { useId } from 'react';
import { cn, Text } from '@holisdk/ui';

// The Holistic brand identity. This is application-specific and deliberately lives in the
// dashboard app, NOT in holisdk: a project-neutral SDK ships no product's mark. holisdk
// provides the neutral frame (AuthScene/AuthCard accept a `logo`); the app supplies this.

/** The Holistic app glyph: a golden star with a swirling orbit on a squircle tile.
    A CSS mask clips an element's box-shadow too, so the elevation lives on an
    unmasked outer wrapper (rounded-[28%] ≈ the squircle silhouette) while the inner
    tile carries the squircle mask + gradient. */
export function HolisticMark({ className }: { className?: string }) {
  const uid = useId().replace(/[:]/g, '');
  const starId = `hm-star-${uid}`;
  const orbitId = `hm-orbit-${uid}`;
  return (
    <div className={cn('relative h-12 w-12 rounded-[28%] shadow-elev-2', className)}>
      <div className="absolute inset-0 flex items-center justify-center squircle bg-[linear-gradient(155deg,#fff6e2,#ffe6b0)]">
      <svg viewBox="0 0 32 32" className="h-2/3 w-2/3" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id={starId} x1="9" y1="6" x2="22" y2="25" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#FFE7A0" />
            <stop offset="0.5" stopColor="#FFC23C" />
            <stop offset="1" stopColor="#E8920F" />
          </linearGradient>
          <linearGradient id={orbitId} x1="4" y1="26" x2="28" y2="6" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#F6B73C" stopOpacity="0" />
            <stop offset="0.55" stopColor="#FFCB57" />
            <stop offset="1" stopColor="#FFE9B8" />
          </linearGradient>
        </defs>
        {/* orbit swoosh (drawn behind the star) */}
        <path d="M7 24 C0 17 3 6 14 5 C24 4 30 10 28 19" stroke={`url(#${orbitId})`} strokeWidth="2" strokeLinecap="round" />
        {/* five-point gold star */}
        <path
          d="M16 7 L18.23 12.93 L24.56 13.22 L19.61 17.17 L21.29 23.28 L16 19.8 L10.71 23.28 L12.39 17.17 L7.44 13.22 L13.77 12.93 Z"
          fill={`url(#${starId})`}
          stroke="#E8920F"
          strokeWidth="0.4"
          strokeLinejoin="round"
        />
        {/* comet sparkle at the orbit head */}
        <path d="M28 15.6 L28.9 17.1 L30.4 18 L28.9 18.9 L28 20.4 L27.1 18.9 L25.6 18 L27.1 17.1 Z" fill="#FFEFC4" />
      </svg>
      </div>
    </div>
  );
}

/** The sidebar wordmark: the glyph next to the static product name. The name is a brand
    constant (not localized), per the per-app-distribution axiom. */
export function Brand() {
  return (
    <div className="flex items-center gap-2">
      <HolisticMark className="h-8 w-8" />
      <Text variant="subhead" weight="semibold" className="tracking-[-0.01em]">
        Holistic
      </Text>
    </div>
  );
}
