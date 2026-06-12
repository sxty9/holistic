/** Formatting helpers for metric displays. Complements formatBytes/formatDate
 *  (exported from ../files/FileBrowser) with percent, throughput, and durations. */

/** "42%" / "42.5%" — value is already 0..100. */
export function formatPercent(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '–';
  return `${value.toFixed(digits)}%`;
}

const RATE_UNITS = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'] as const;

/** Humanize a bytes-per-second throughput, e.g. 1536000 → "1.5 MB/s". */
export function formatRate(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '0 B/s';
  // Clamp the unit index to [0, last]: sub-1 B/s would otherwise give index -1 → undefined unit.
  const i = Math.max(0, Math.min(RATE_UNITS.length - 1, Math.floor(Math.log(bytesPerSec) / Math.log(1024))));
  const n = bytesPerSec / 1024 ** i;
  return `${n.toFixed(i === 0 ? 0 : 1)} ${RATE_UNITS[i]}`;
}

/** Humanize a duration in seconds into the two most significant units,
 *  e.g. 93784 → "1d 2h", 312 → "5m 12s", 45 → "45s". For uptime/load windows. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '–';
  const s = Math.floor(seconds);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`, `${h}h`);
  else if (h) parts.push(`${h}h`, `${m}m`);
  else if (m) parts.push(`${m}m`, `${sec}s`);
  else parts.push(`${sec}s`);
  return parts.slice(0, 2).join(' ');
}
