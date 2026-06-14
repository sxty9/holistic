import { useId, type ReactNode } from 'react';
import { cn } from './lib/cn';

// Token-driven palette (channels → rgb()). Series cycle through these unless a color is given.
const PALETTE = ['rgb(var(--accent))', 'rgb(var(--success))', 'rgb(var(--warning))', 'rgb(var(--danger))'] as const;

// Internal viewBox width; height is the prop. preserveAspectRatio="none" stretches to the box,
// so stroke width is compensated via vector-effect: non-scaling-stroke.
const VBW = 100;

function extent(series: { data: number[] }[], min?: number, max?: number): [number, number] {
  if (min !== undefined && max !== undefined) return [min, max];
  let lo = min ?? Infinity;
  let hi = max ?? -Infinity;
  for (const s of series) for (const v of s.data) {
    if (!Number.isFinite(v)) continue;
    // Only stretch the bound the caller did NOT fix, so an explicit min/max is honored.
    if (min === undefined && v < lo) lo = v;
    if (max === undefined && v > hi) hi = v;
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return [0, 1];
  if (lo === hi) return [lo - 1, hi + 1];
  return [lo, hi];
}

/** Build "M x y L …" across the data, mapped into the [0,VBW]×[0,height] box. */
function linePath(data: number[], lo: number, hi: number, height: number): string {
  const n = data.length;
  if (n === 0) return '';
  const span = hi - lo || 1;
  const x = (i: number) => (n === 1 ? VBW / 2 : (i / (n - 1)) * VBW);
  const y = (v: number) => height - ((Math.max(lo, Math.min(hi, v)) - lo) / span) * height;
  return data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(' ');
}

export interface ChartSeries {
  data: number[];
  /** CSS color; defaults to the palette by index. */
  color?: string;
  label?: string;
  /** Fill the area beneath the line with a faint gradient. */
  fill?: boolean;
}

export interface LineChartProps {
  series: ChartSeries[];
  height?: number;
  /** Fixed y-range; auto-scales to the data when omitted. Use [0,100] for percentages. */
  min?: number;
  max?: number;
  strokeWidth?: number;
  className?: string;
}

/** Lightweight multi-series line/area chart (pure SVG, no dependencies). */
export function LineChart({ series, height = 120, min, max, strokeWidth = 2, className }: LineChartProps) {
  const gid = useId().replace(/:/g, '');
  const [lo, hi] = extent(series, min, max);
  return (
    <svg
      viewBox={`0 0 ${VBW} ${height}`}
      preserveAspectRatio="none"
      className={cn('w-full', className)}
      style={{ height }}
      aria-hidden="true"
    >
      {series.map((s, i) => {
        const color = s.color ?? PALETTE[i % PALETTE.length];
        const d = linePath(s.data, lo, hi, height);
        if (!d) return null;
        const fillId = `${gid}-f${i}`;
        return (
          <g key={i}>
            {s.fill && (
              <>
                <defs>
                  <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <path d={`${d} L${VBW} ${height} L0 ${height} Z`} fill={`url(#${fillId})`} stroke="none" />
              </>
            )}
            <path
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        );
      })}
    </svg>
  );
}

export interface SparklineProps {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
  className?: string;
}

/** Compact inline trend line for metric tiles and table rows. */
export function Sparkline({ data, color = 'rgb(var(--accent))', height = 28, fill = true, className }: SparklineProps) {
  const gid = useId().replace(/:/g, '');
  const [lo, hi] = extent([{ data }]);
  const d = linePath(data, lo, hi, height);
  return (
    <svg viewBox={`0 0 ${VBW} ${height}`} preserveAspectRatio="none" className={cn('w-full', className)} style={{ height }} aria-hidden="true">
      {fill && d && (
        <>
          <defs>
            <linearGradient id={`${gid}-s`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <path d={`${d} L${VBW} ${height} L0 ${height} Z`} fill={`url(#${gid}-s)`} stroke="none" />
        </>
      )}
      {d && <path d={d} fill="none" stroke={color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
    </svg>
  );
}

export interface StreamSeries {
  label: string;
  /** CSS fill color (e.g. 'rgb(var(--cpu))'). */
  color: string;
  data: number[];
}

export interface StreamGraphProps {
  series: StreamSeries[];
  height?: number;
  className?: string;
}

/** Stacked-area ("stream") chart: each series is filled and stacked on the one
 *  below it, sharing an auto-scaled y-axis. Pair with <Legend> for series names. */
export function StreamGraph({ series, height = 120, className }: StreamGraphProps) {
  const n = series.reduce((m, s) => Math.max(m, s.data.length), 0);
  if (n === 0 || series.length === 0) {
    return <svg viewBox={`0 0 ${VBW} ${height}`} className={cn('w-full', className)} style={{ height }} aria-hidden="true" />;
  }
  // Cumulative stack tops per x; the running max total sets the y-scale.
  const tops: number[][] = [];
  const cum = new Array(n).fill(0);
  for (const s of series) {
    const top = new Array(n);
    for (let i = 0; i < n; i++) {
      cum[i] += Math.max(0, s.data[i] ?? 0);
      top[i] = cum[i];
    }
    tops.push(top);
  }
  const maxTotal = Math.max(1, ...cum);
  const x = (i: number) => (n === 1 ? VBW / 2 : (i / (n - 1)) * VBW);
  const y = (v: number) => height - (v / maxTotal) * height;
  return (
    <svg viewBox={`0 0 ${VBW} ${height}`} preserveAspectRatio="none" className={cn('w-full', className)} style={{ height }} aria-hidden="true">
      {series.map((s, si) => {
        const upper = tops[si];
        const lower = si === 0 ? null : tops[si - 1];
        let d = `M${x(0).toFixed(2)} ${y(upper[0]).toFixed(2)}`;
        for (let i = 1; i < n; i++) d += ` L${x(i).toFixed(2)} ${y(upper[i]).toFixed(2)}`;
        if (lower) {
          for (let i = n - 1; i >= 0; i--) d += ` L${x(i).toFixed(2)} ${y(lower[i]).toFixed(2)}`;
        } else {
          d += ` L${x(n - 1).toFixed(2)} ${height} L${x(0).toFixed(2)} ${height}`;
        }
        return <path key={si} d={`${d} Z`} fill={s.color} fillOpacity={0.85} stroke="none" />;
      })}
    </svg>
  );
}

export interface LegendItem {
  label: ReactNode;
  /** CSS color of the swatch (e.g. 'rgb(var(--cpu))'). */
  color: string;
}

export interface LegendProps {
  items: LegendItem[];
  className?: string;
}

/** Inline color key for multi-series charts — a row of swatch + label pairs. */
export function Legend({ items, className }: LegendProps) {
  return (
    <div className={cn('flex flex-wrap items-center gap-x-4 gap-y-1', className)}>
      {items.map((it, i) => (
        <span key={i} className="inline-flex items-center gap-1.5 text-caption text-text-secondary">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: it.color }} aria-hidden="true" />
          {it.label}
        </span>
      ))}
    </div>
  );
}
