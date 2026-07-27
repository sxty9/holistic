/** A tiny module-level store for the imperative SDK surfaces the shell mounts once (toast,
 *  confirm): a single value plus listener notification, shaped for React's useSyncExternalStore.
 *  It lets those surfaces be handed to services as plain functions with no React context to thread
 *  through the ServiceContextProps bridge, and keeps the subscribe/notify/snapshot plumbing in ONE
 *  place instead of re-hand-rolled per surface (keine Redundanz). */
export interface Store<T> {
  /** Current value — pass as getSnapshot (and getServerSnapshot) to useSyncExternalStore. */
  snapshot: () => T;
  /** Replace the value, or map it from the previous one, then notify subscribers. */
  set: (next: T | ((prev: T) => T)) => void;
  /** Subscribe to changes; returns an unsubscribe. */
  subscribe: (listener: () => void) => () => void;
}

export function createStore<T>(initial: T): Store<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    snapshot: () => value,
    set: (next) => {
      value = typeof next === 'function' ? (next as (prev: T) => T)(value) : next;
      listeners.forEach((l) => l());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
