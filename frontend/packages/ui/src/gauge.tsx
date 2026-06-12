import type { ReactNode } from 'react';
import { cn } from './lib/cn';
import { formatPercent } from './lib/format';

export type Tone = 'accent' | 'success' | 'warning' | 'danger';

const TONE: Record<Tone, string> = {
  accent: 'rgb(var(--accent))',
  success: 'rgb(var(--success))',
  warning: 'rgb(var(--warning))',
  danger: 'rgb(var(--danger))',
};
const TRACK = 'rgb(var(--fill) / 0.18)';

/** Map a utilization percentage to a severity tone: green < 70, amber < 90, red ≥ 90. */
export function toneForLoad(percent: number): Tone {
  if (percent >= 90) return 'danger';
  if (percent >= 70) return 'warning';
  return 'success';
}

export interface GaugeProps {
  /** 0..100 */
  value: number;
  size?: number;
  thickness?: number;
  tone?: Tone;
  /** Center content; defaults to the value as a percentage. Pass null to hide. */
  label?: ReactNode;
  sublabel?: ReactNode;
  className?: string;
}

/** Circular radial progress for a single percentage (CPU%, RAM%, disk%). */
export function Gauge({ value, size = 120, thickness = 10, tone = 'accent', label, sublabel, className }: GaugeProps) {
  const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const center = label === undefined ? formatPercent(pct) : label;
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={thickness} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={TONE[tone]}
          strokeWidth={thickness}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="transition-[stroke-dashoffset] duration-base ease-out"
        />
      </svg>
      {center !== null && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-title3 font-semibold text-text-primary tabular-nums">{center}</span>
          {sublabel && <span className="text-caption text-text-secondary">{sublabel}</span>}
        </div>
      )}
    </div>
  );
}

export interface DonutSegment {
  value: number;
  color?: string;
  label?: string;
}

export interface DonutProps {
  segments: DonutSegment[];
  size?: number;
  thickness?: number;
  /** Denominator; defaults to the sum of segment values. */
  total?: number;
  center?: ReactNode;
  className?: string;
}

/** Composition ring (e.g. RAM used/cached/free, disk partitions). */
export function Donut({ segments, size = 120, thickness = 12, total, center, className }: DonutProps) {
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const sum = (total ?? segments.reduce((a, s) => a + Math.max(0, s.value), 0)) || 1;
  let acc = 0;
  return (
    <div className={cn('relative inline-flex items-center justify-center', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={thickness} />
        {segments.map((s, i) => {
          const frac = Math.max(0, s.value) / sum;
          const seg = (
            <circle
              key={i}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color ?? Object.values(TONE)[i % 4]}
              strokeWidth={thickness}
              strokeDasharray={`${c * frac} ${c}`}
              strokeDashoffset={-c * acc}
            />
          );
          acc += frac;
          return seg;
        })}
      </svg>
      {center && <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{center}</div>}
    </div>
  );
}
