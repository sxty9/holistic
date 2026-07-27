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

/** A locale-aware "time ago" label for an ISO timestamp — "5 min ago", "3 days ago",
 *  "now" — via Intl.RelativeTimeFormat, so every locale is rendered from the platform
 *  without a single translation string. Past ~a week it reads better as a short absolute
 *  date. `now` is injectable for deterministic tests; unparseable input yields "". Pure
 *  Intl/Date (no DOM), so the shared core stays platform-neutral. */
export function formatRelativeTime(iso: string, locale: string = 'en-US', now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const sec = Math.round((now - then) / 1000); // > 0 in the past
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto', style: 'short' });
  if (Math.abs(sec) < 45) return rtf.format(0, 'second'); // "now" / "jetzt" / "今"
  const min = Math.round(sec / 60);
  if (Math.abs(min) < 60) return rtf.format(-min, 'minute');
  const hour = Math.round(sec / 3600);
  if (Math.abs(hour) < 24) return rtf.format(-hour, 'hour');
  const day = Math.round(sec / 86400);
  if (Math.abs(day) < 7) return rtf.format(-day, 'day');
  return new Date(then).toLocaleDateString(locale, { day: 'numeric', month: 'short' });
}
