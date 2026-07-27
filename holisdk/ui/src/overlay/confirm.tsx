import { useSyncExternalStore, type ReactNode } from 'react';
import { Modal } from './modal';
import { Button } from '../controls';
import { createStore } from '../lib/store';

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

const store = createStore<PendingConfirm[]>([]);
let nextId = 1;

/** Imperative confirm — resolves true/false. Backed by <ConfirmRoot/> mounted in the shell. */
export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    store.set((queue) => [...queue, { id: nextId++, opts, resolve }]);
  });
}

function settle(id: number, value: boolean) {
  const item = store.snapshot().find((q) => q.id === id);
  store.set((queue) => queue.filter((q) => q.id !== id));
  item?.resolve(value);
}

export function ConfirmRoot() {
  const q = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
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
