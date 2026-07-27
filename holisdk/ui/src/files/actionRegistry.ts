/** A minimal in-memory registry for the extension actions a service contributes at module load —
 *  folder actions and file-viewer actions. Both share the exact same mechanism: register
 *  idempotently by id (safe across hot reloads / repeated imports) and list in registration order.
 *  So the mechanism lives here once and each action kind is just `createActionRegistry<ItsType>()`
 *  (Reuse-before-Build, keine ähnlichen Geschwister); the two modules keep only their own types. */
export interface ActionRegistry<T extends { id: string }> {
  /** Register an action. Idempotent by id — re-registering the same id replaces it. */
  register(action: T): void;
  /** All registered actions, in registration order. Callers filter by visibility/type. */
  all(): readonly T[];
}

export function createActionRegistry<T extends { id: string }>(): ActionRegistry<T> {
  const registry: T[] = [];
  return {
    register(action) {
      const i = registry.findIndex((a) => a.id === action.id);
      if (i >= 0) registry[i] = action;
      else registry.push(action);
    },
    all() {
      return registry;
    },
  };
}
