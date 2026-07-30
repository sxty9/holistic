import { useSyncExternalStore, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { createStore } from '../lib/store';
import { AlertIcon, CheckIcon, InfoIcon, XIcon } from '../icons';
import { useT } from '../i18n';

export type ToastVariant = 'info' | 'success' | 'error';
export interface ToastItem {
  id: number;
  title: string;
  description?: ReactNode;
  variant: ToastVariant;
  /** Set while the card plays its exit animation; it then removes itself. */
  leaving?: boolean;
}

// Module-level store so the shell can hand services a plain `toast()` function
// (no React context to thread through the ServiceContextProps bridge).
const store = createStore<ToastItem[]>([]);
let nextId = 1;

export function toast(opts: { title: string; description?: ReactNode; variant?: ToastVariant }): number {
  const id = nextId++;
  store.set((items) => [...items, { id, title: opts.title, description: opts.description, variant: opts.variant ?? 'info' }]);
  setTimeout(() => dismissToast(id), 4500);
  return id;
}

// Trigger the exit animation; the card calls removeToast on animationend.
export function dismissToast(id: number) {
  store.set((items) => items.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
}

function removeToast(id: number) {
  store.set((items) => items.filter((i) => i.id !== id));
}

const ICON: Record<ToastVariant, ReactNode> = { info: <InfoIcon />, success: <CheckIcon />, error: <AlertIcon /> };
const COLOR: Record<ToastVariant, string> = { info: 'text-accent', success: 'text-success', error: 'text-danger' };

export function Toaster() {
  const tr = useT();
  const list = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  return (
    <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(22rem,90vw)]">
      {list.map((t) => (
        <div
          key={t.id}
          onAnimationEnd={() => {
            if (t.leaving) removeToast(t.id);
          }}
          className={cn(
            'flex items-start gap-3 rounded-md border border-separator bg-material-thick [backdrop-filter:var(--material-blur)] p-3 shadow-elev-3',
            t.leaving ? 'animate-toast-out' : 'animate-toast-in',
          )}
        >
          <span className={cn('mt-0.5 [&>svg]:h-5 [&>svg]:w-5', COLOR[t.variant])}>{ICON[t.variant]}</span>
          <div className="flex-1 min-w-0">
            <div className="text-footnote font-semibold text-text-primary">{t.title}</div>
            {t.description && <div className="text-caption text-text-secondary">{t.description}</div>}
          </div>
          <button onClick={() => dismissToast(t.id)} aria-label={tr('common.close')} className="text-text-tertiary hover:text-text-secondary">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
