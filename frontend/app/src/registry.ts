import type { ServicePlugin } from '@holistic/ui';

// Build-time discovery: every services/<name>/ui/index.tsx default export becomes a plugin.
// The glob literal cannot contain variables (Vite constraint), so the path is hardcoded.
// Path is relative to this file (frontend/app/src) → repo-root/services/*/ui/index.tsx.
const modules = import.meta.glob<ServicePlugin>('../../../services/*/ui/index.tsx', {
  eager: true,
  import: 'default',
});

function build(): ServicePlugin[] {
  const seen = new Set<string>();
  const plugins: ServicePlugin[] = [];
  for (const [path, plugin] of Object.entries(modules)) {
    if (!plugin || typeof plugin.id !== 'string' || typeof plugin.Component !== 'function') {
      throw new Error(`[registry] ${path} default export is not a ServicePlugin`);
    }
    const dir = path.split('/').at(-3); // services/<dir>/ui/index.tsx
    if (plugin.id !== dir) throw new Error(`[registry] ${path}: plugin.id "${plugin.id}" must equal dir "${dir}"`);
    if (seen.has(plugin.id)) throw new Error(`[registry] duplicate service id "${plugin.id}"`);
    seen.add(plugin.id);
    plugins.push(plugin);
  }
  return plugins.sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.displayName.localeCompare(b.displayName));
}

export const SERVICES: readonly ServicePlugin[] = build();
export const serviceById = (id: string) => SERVICES.find((s) => s.id === id);
