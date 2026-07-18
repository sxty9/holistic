import { useState } from 'react';
import {
  Button,
  ChevronDownIcon,
  DropdownMenu,
  EmptyState,
  Input,
  Panel,
  PasswordInput,
  SegmentedControl,
  SettingsIcon,
  Spinner,
  Stack,
  Switch,
  Text,
  useLiveQuery,
  useT,
  type ServiceApiClient,
  type ServiceContextProps,
  type ServiceUiBridge,
} from '@holistic/ui';

// The central configuration editor: every service that dropped a manifest into
// /etc/holistic/config.d gets one section here, and nothing else in holistic asks an admin to
// configure anything. The service tabs stay about the user's experience.
//
// A setting is declared by its service (id, label, type, default); this UI only ever moves
// VALUES. It never learns a service's semantics, so a new service becomes configurable by
// dropping a manifest — no change here.

type SettingType = 'string' | 'int' | 'bool' | 'enum' | 'secret';
type SettingValue = string | number | boolean;

interface SettingDecl {
  id: string;
  label: string;
  type: SettingType;
  default: SettingValue;
  options?: string[] | null;
  dangerous?: boolean;
}
interface CategoryDecl {
  id: string;
  label: string;
  settings: SettingDecl[];
}
interface ConfigManifest {
  service: string;
  version: number;
  categories: CategoryDecl[];
}
interface ValuesResponse {
  service: string;
  settings: Record<string, SettingValue>;
}

export function Config({ api, ui }: ServiceContextProps) {
  const t = useT();
  const manifests = useLiveQuery<ConfigManifest[]>(() => api.get<ConfigManifest[]>('manifests'), 30000);
  const services = manifests.data;

  if (!services) {
    return manifests.loading ? <Spinner /> : <Text color="danger">{t('config.loadFailed')}</Text>;
  }
  if (services.length === 0) {
    return <EmptyState icon={<SettingsIcon />} title={t('config.empty')} />;
  }

  return (
    <Stack gap={4}>
      {services.map((m) => (
        <ServiceSection key={m.service} manifest={m} api={api} ui={ui} />
      ))}
    </Stack>
  );
}

function ServiceSection({ manifest, api, ui }: { manifest: ConfigManifest; api: ServiceApiClient; ui: ServiceUiBridge }) {
  const t = useT();
  // Labels come from the manifest but are localized by their stable id where a translation
  // exists — the same fallback rule the rights catalog uses.
  const tr = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);
  const service = manifest.service;
  const values = useLiveQuery<ValuesResponse>(() => api.get<ValuesResponse>(`values/${service}`), 30000, [service]);
  // Only the admin's unsaved edits live here; the saved values keep polling underneath, so a
  // background refresh can never overwrite what is being typed.
  const [edits, setEdits] = useState<Record<string, SettingValue>>({});
  const [saving, setSaving] = useState(false);

  const saved = values.data?.settings;
  const decls = manifest.categories.flatMap((c) => c.settings);
  const dirty = Object.keys(edits).length > 0;
  const serviceLabel = tr(`service.${service}`, service);
  const labelOf = (s: SettingDecl) => tr(`config.set.${service}.${s.id}`, s.label);
  const valueOf = (s: SettingDecl): SettingValue => edits[s.id] ?? saved?.[s.id] ?? s.default;

  async function save() {
    // Coerce to the declared type before sending — an int field is edited as text, and the
    // backend rejects (never converts) anything of the wrong type.
    const payload: Record<string, SettingValue> = {};
    for (const s of decls) {
      const v = valueOf(s);
      if (s.type === 'int') {
        const n = Number.parseInt(String(v), 10);
        if (!Number.isFinite(n)) {
          ui.toast({ title: t('config.invalidNumber', { label: labelOf(s) }), variant: 'error' });
          return;
        }
        payload[s.id] = n;
      } else if (s.type === 'bool') {
        payload[s.id] = Boolean(v);
      } else {
        payload[s.id] = String(v);
      }
    }

    const risky = decls.filter((s) => s.dangerous && s.id in edits);
    if (risky.length > 0) {
      const ok = await ui.confirm({
        title: t('config.confirmTitle', { labels: risky.map(labelOf).join(', ') }),
        danger: true,
        confirmLabel: t('config.save'),
      });
      if (!ok) return;
    }

    setSaving(true);
    try {
      await api.put(`values/${service}`, { settings: payload });
      setEdits({});
      ui.toast({ title: t('config.saved', { service: serviceLabel }), variant: 'success' });
    } catch (e) {
      ui.toast({ title: t('config.saveFailed'), description: (e as Error).message, variant: 'error' });
    } finally {
      setSaving(false);
      values.refresh(); // re-sync to the server's actual state, saved or failed
    }
  }

  return (
    <Panel
      title={serviceLabel}
      className="p-4"
      actions={
        <Button variant="primary" size="sm" disabled={!dirty || !saved} loading={saving} onClick={save}>
          {t('config.save')}
        </Button>
      }
    >
      {!saved ? (
        <Spinner />
      ) : (
        <Stack gap={4}>
          {manifest.categories.map((c) => (
            <Stack key={c.id} gap={3}>
              <Text variant="footnote" color="secondary" weight="semibold">
                {tr(`config.cat.${service}.${c.id}`, c.label)}
              </Text>
              {c.settings.map((s) => (
                <Stack key={s.id} direction="row" align="center" justify="between" gap={3}>
                  <Text weight="medium">{labelOf(s)}</Text>
                  <SettingControl
                    decl={s}
                    value={valueOf(s)}
                    onChange={(v) => setEdits((prev) => ({ ...prev, [s.id]: v }))}
                  />
                </Stack>
              ))}
            </Stack>
          ))}
        </Stack>
      )}
    </Panel>
  );
}

function SettingControl({ decl, value, onChange }: { decl: SettingDecl; value: SettingValue; onChange: (v: SettingValue) => void }) {
  const options = decl.options ?? [];

  switch (decl.type) {
    case 'bool':
      return <Switch checked={Boolean(value)} onChange={onChange} />;
    case 'enum':
      // Few options read best laid out side by side; a long list belongs behind a menu.
      return options.length <= 3 ? (
        <SegmentedControl options={options.map((o) => ({ value: o, label: o }))} value={String(value)} onChange={onChange} />
      ) : (
        <DropdownMenu
          trigger={
            <Button size="sm" iconRight={<ChevronDownIcon className="h-4 w-4" />}>
              {String(value)}
            </Button>
          }
          items={options.map((o) => ({ id: o, label: o, checked: o === value, onSelect: () => onChange(o) }))}
        />
      );
    case 'secret':
      return <PasswordInput className="w-64" value={String(value)} onChange={(e) => onChange(e.target.value)} />;
    case 'int':
      return <Input className="w-64" type="number" inputMode="numeric" value={String(value)} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <Input className="w-64" value={String(value)} onChange={(e) => onChange(e.target.value)} />;
  }
}
