import { useSyncExternalStore, type ReactNode } from 'react';
import { Modal } from './modal';
import { Button } from '../controls';

export interface ConfirmOptions {
  title: string;
  description?: ReactNode;
  danger?: boolean;
  confirmLabel?: string;
}
interface PendingConfirm {
  id: number;
  opts: ConfirmOptions;
  resolve: (v: boolean) => void;
}

let queue: PendingConfirm[] = [];
const listeners = new Set<() => void>();
let nextId = 1;

function notify() {
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
function snapshot() {
  return queue;
}

/** Imperative confirm — resolves true/false. Backed by <ConfirmRoot/> mounted in the shell. */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [...queue, { id: nextId++, opts, resolve }];
    notify();
  });
}

function settle(id: number, value: boolean) {
  const item = queue.find((q) => q.id === id);
  queue = queue.filter((q) => q.id !== id);
  notify();
  item?.resolve(value);
}

export function ConfirmRoot() {
  const q = useSyncExternalStore(subscribe, snapshot, snapshot);
  const cur = q[0];
  return (
    <Modal
      open={!!cur}
      onOpenChange={(o) => {
        if (!o && cur) settle(cur.id, false);
      }}
      title={cur?.opts.title}
      description={cur?.opts.description}
      size="sm"
      footer={
        cur ? (
          <>
            <Button variant="ghost" onClick={() => settle(cur.id, false)}>
              Cancel
            </Button>
            <Button variant={cur.opts.danger ? 'destructive' : 'primary'} onClick={() => settle(cur.id, true)}>
              {cur.opts.confirmLabel ?? 'Confirm'}
            </Button>
          </>
        ) : undefined
      }
    />
  );
}
