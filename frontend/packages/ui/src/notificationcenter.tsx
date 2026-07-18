import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from './lib/cn';
import { IconButton } from './controls';
import { Text, Spinner } from './primitives';
import { BellIcon } from './icons';
import { toast, type ToastVariant } from './overlay/toast';
import type { ServiceApiClient } from './plugin/contract';

// One notification as notify's API returns it (mirrors notify/internal/store.Notification JSON).
export interface NotificationItem {
  seq: number;
  id: string;
  service: string;
  title: string;
  body?: string;
  url?: string;
  icon?: string;
  level: string; // info | success | warning | error
  created: string;
  read: boolean;
}

export interface NotificationCenterProps {
  /** A client for the notify service (apiFor('notify')). */
  api: ServiceApiClient;
  /** Open a notification's deep link. Given a root-relative path the shell should route in-app;
   *  when omitted, the component falls back to window.location / window.open. */
  onOpenUrl?: (url: string) => void;
}

const toastVariant = (level: string): ToastVariant => (level === 'error' ? 'error' : level === 'success' ? 'success' : 'info');

// A colour for the per-notification unread dot / accent, by level.
const dotColor: Record<string, string> = {
  info: 'bg-accent',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-danger',
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const s = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (s < 45) return 'gerade eben';
  const m = Math.round(s / 60);
  if (m < 60) return `vor ${m} Min`;
  const h = Math.round(m / 60);
  if (h < 24) return `vor ${h} Std`;
  const d = Math.round(h / 24);
  if (d < 7) return `vor ${d} T`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// NotificationCenter is the shell's top-bar bell: a live, cross-service notification hub. It lists
// the caller's recent notifications (via the notify service), streams new ones over one always-on
// EventSource, raises a desktop Notification when the tab is hidden (else an in-app toast), and
// clears its unread badge when opened. Rendered in every service tab, independent of the active one.
export function NotificationCenter({ api, onOpenUrl }: NotificationCenterProps) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const supported = typeof Notification !== 'undefined';
  const [perm, setPerm] = useState<NotificationPermission>(supported ? Notification.permission : 'denied');

  // Dedup live frames by a monotonic high-water-mark (a frame is new only if its seq exceeds
  // everything seen) rather than an ever-growing Set. The badge uses the server's authoritative
  // unread total, not a count derived from the truncated item window.
  const maxSeqRef = useRef(0);
  const openRef = useRef(open);
  openRef.current = open;
  const [unread, setUnread] = useState(0);

  // Keep the latest onOpenUrl for the long-lived SSE + Notification click handlers.
  const openUrlRef = useRef(onOpenUrl);
  openUrlRef.current = onOpenUrl;
  const openUrl = useCallback((url: string) => {
    if (!url) return;
    // Allowlist: a root-relative in-app path (never //host or /\host) routes in-app; an http(s)
    // URL opens in a new tab. Anything else (javascript:, data:, protocol-relative, …) is dropped
    // — client-side defence-in-depth even though the server also sanitises the URL.
    if (url.startsWith('/') && !url.startsWith('//') && !url.startsWith('/\\')) {
      if (openUrlRef.current) openUrlRef.current(url);
      else window.location.assign(url);
    } else if (/^https?:\/\//.test(url)) {
      window.open(url, '_blank', 'noopener');
    }
  }, []);

  // Initial load.
  useEffect(() => {
    let alive = true;
    api.get<{ notifications: NotificationItem[]; unread: number }>('notifications').then(
      (r) => {
        if (!alive) return;
        const list = r.notifications ?? [];
        maxSeqRef.current = list.reduce((m, n) => Math.max(m, n.seq), maxSeqRef.current);
        setItems(list);
        setUnread(r.unread ?? 0);
        setLoading(false);
      },
      () => alive && setLoading(false),
    );
    return () => {
      alive = false;
    };
  }, [api]);

  // Live stream. EventSource auto-reconnects and replays via Last-Event-ID (the id: frames); the
  // server dedupes replay/live overlap, and the high-water-mark guards against any residual dup.
  useEffect(() => {
    let es: EventSource | null = null;
    try {
      es = new EventSource(api.url('notifications/stream'));
    } catch {
      return;
    }
    const onNotify = (e: MessageEvent) => {
      let n: NotificationItem;
      try {
        n = JSON.parse(e.data) as NotificationItem;
      } catch {
        return;
      }
      if (n.seq <= maxSeqRef.current) return; // already delivered (out-of-order replay)
      maxSeqRef.current = n.seq;
      const openNow = openRef.current;
      // If the panel is open the user is already looking at the list: show the item read and clear
      // it server-side without raising the badge. Otherwise bump the badge and signal once.
      setItems((prev) => [{ ...n, read: openNow ? true : n.read }, ...prev].slice(0, 50));
      if (n.read) return;
      if (openNow) {
        api.post('notifications/read', { ids: [n.id] }).catch(() => {});
        return;
      }
      setUnread((u) => u + 1);
      // Signal the arrival once: a desktop notification when the tab is in the background,
      // otherwise an in-app toast.
      if (supported && Notification.permission === 'granted' && document.hidden) {
        try {
          const bn = new Notification(n.title, { body: n.body, tag: n.id });
          bn.onclick = () => {
            window.focus();
            if (n.url) openUrl(n.url);
            bn.close();
          };
        } catch {
          /* some browsers throw if not user-activated; ignore */
        }
      } else {
        toast({ title: n.title, description: n.body, variant: toastVariant(n.level) });
      }
    };
    es.addEventListener('notify', onNotify as EventListener);
    return () => {
      if (es) es.close();
    };
  }, [api, supported, openUrl]);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      // Opening is a user gesture: a good moment to ask for desktop-notification permission.
      if (supported && Notification.permission === 'default') {
        Notification.requestPermission().then((p) => setPerm(p)).catch(() => {});
      }
      // Clear the badge: mark everything read (optimistic; server is the source of truth).
      setUnread(0);
      setItems((prev) => prev.map((i) => ({ ...i, read: true })));
      api.post('notifications/read-all').catch(() => {});
    }
  }

  function activate(n: NotificationItem) {
    if (n.url) openUrl(n.url);
    setOpen(false);
  }

  return (
    <div className="relative">
      <IconButton label="Benachrichtigungen" onClick={toggle}>
        <span className="relative inline-flex">
          <BellIcon />
          {unread > 0 && (
            <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </span>
      </IconButton>

      {open && (
        <>
          {/* Click-away backdrop. */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-lg border border-separator bg-surface-raised shadow-elev-2">
            <div className="flex items-center justify-between border-b border-separator px-3 py-2">
              <Text variant="subhead" weight="semibold">
                Benachrichtigungen
              </Text>
            </div>

            {supported && perm === 'default' && (
              <button
                type="button"
                onClick={() => Notification.requestPermission().then((p) => setPerm(p)).catch(() => {})}
                className="w-full border-b border-separator px-3 py-2 text-left text-footnote text-accent hover:bg-fill/10"
              >
                Desktop-Benachrichtigungen aktivieren
              </button>
            )}

            <div className="max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Spinner className="h-4 w-4" />
                  <Text color="secondary" variant="footnote">
                    Lädt…
                  </Text>
                </div>
              ) : items.length === 0 ? (
                <div className="px-3 py-8 text-center">
                  <Text color="tertiary" variant="footnote">
                    Keine Benachrichtigungen
                  </Text>
                </div>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => activate(n)}
                    className={cn(
                      'flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-fill/10',
                      !n.read && 'bg-fill/5',
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden>
                      {n.icon || '🔔'}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-subhead text-text-primary">{n.title}</span>
                      </span>
                      {n.body && <span className="line-clamp-2 text-footnote text-text-secondary">{n.body}</span>}
                      <span className="mt-0.5 text-caption text-text-tertiary">
                        {n.service} · {relativeTime(n.created)}
                      </span>
                    </span>
                    {!n.read && <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', dotColor[n.level] || 'bg-accent')} />}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
