import type { ServicePlugin } from '@holistic/ui';

// Build-time discovery. Two sources, both default-exporting a ServicePlugin:
//   • in-repo services:      services/<name>/ui/index.tsx
//   • external service repos: frontend/external/<name>/index.tsx
//     (a separate repo links its UI here at install time, e.g. hostek)
// Glob literals cannot contain variables (Vite constraint), so both paths are
// hardcoded, relative to this file (frontend/app/src). A missing external/ dir
// simply matches nothing.
const internal = import.meta.glob<ServicePlugin>('../../../services/*/ui/index.tsx', { eager: true, import: 'default' });
const external = import.meta.glob<ServicePlugin>('../../external/*/index.tsx', { eager: true, import: 'default' });

function build(): ServicePlugin[] {
  const seen = new Set<string>();
  const plugins: ServicePlugin[] = [];

  const add = (path: string, plugin: ServicePlugin, dir: string | undefined) => {
    if (!plugin || typeof plugin.id !== 'string' || typeof plugin.Component !== 'function') {
      throw new Error(`[registry] ${path} default export is not a ServicePlugin`);
    }
    if (plugin.id !== dir) throw new Error(`[registry] ${path}: plugin.id "${plugin.id}" must equal dir "${dir}"`);
    if (seen.has(plugin.id)) throw new Error(`[registry] duplicate service id "${plugin.id}"`);
    seen.add(plugin.id);
    plugins.push(plugin);
  };

  for (const [path, plugin] of Object.entries(internal)) add(path, plugin, path.split('/').at(-3)); // services/<dir>/ui/index.tsx
  for (const [path, plugin] of Object.entries(external)) add(path, plugin, path.split('/').at(-2)); // external/<dir>/index.tsx

  return plugins.sort((a, b) => (a.order ?? 100) - (b.order ?? 100) || a.displayName.localeCompare(b.displayName));
}

export const SERVICES: readonly ServicePlugin[] = build();
export const serviceById = (id: string) => SERVICES.find((s) => s.id === id);
