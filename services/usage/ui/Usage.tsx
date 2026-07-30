import {
  BoltIcon,
  CpuIcon,
  DiskIcon,
  EmptyState,
  GaugeIcon,
  MemoryIcon,
  Panel,
  Spinner,
  Stack,
  Stat,
  Text,
  formatBytes,
  formatDuration,
  useLiveQuery,
  useLocale,
  useT,
  type ServiceContextProps,
} from '@holisdk/ui';
import type { ComponentType } from 'react';

// The central Consumption view: it unifies the three consumption interfaces the axioms name —
// AI tokens, compute (Leistung) and storage (Speicher) — in one place, so load and capacity can
// be judged across the whole landscape (analogous to the central Rights and Configuration tabs).
//
// A service DECLARES which metrics it reports (kind + label) in its usage.d manifest and WRITES
// its current values into the passive report pool; this UI only ever RENDERS what the backend
// aggregated. It never learns a service's semantics, so a new service becomes visible here by
// dropping a manifest — no change to this tab. The service tabs stay about the user's experience;
// the telemetry lives only here.

type Kind = 'storage' | 'memory' | 'compute' | 'tokens';

interface Metric {
  id: string;
  label: string;
  kind: Kind;
  unit: 'bytes' | 'seconds' | 'count';
  value: number;
}
interface ServiceUsage {
  service: string;
  version: number;
  metrics: Metric[];
}
interface KindTotal {
  kind: Kind;
  unit: string;
  total: number;
}
interface Report {
  services: ServiceUsage[];
  kinds: KindTotal[];
}

const KIND_ICON: Record<Kind, ComponentType<{ className?: string }>> = {
  storage: DiskIcon,
  memory: MemoryIcon,
  compute: CpuIcon,
  tokens: BoltIcon,
};
// Fixed order for the summary tiles so the overview never reshuffles as services come and go.
const KIND_ORDER: Kind[] = ['storage', 'memory', 'compute', 'tokens'];

function formatValue(unit: Metric['unit'], value: number, locale: string): string {
  if (unit === 'bytes') return formatBytes(value);
  if (unit === 'seconds') return formatDuration(value);
  return value.toLocaleString(locale); // count (e.g. AI tokens)
}

export function Usage({ api }: ServiceContextProps) {
  const t = useT();
  const [locale] = useLocale();
  const report = useLiveQuery<Report>(() => api.get<Report>('report'), 10000);
  const data = report.data;

  if (!data) {
    return report.loading ? <Spinner /> : <Text color="danger">{t('usage.loadFailed')}</Text>;
  }
  if (data.services.length === 0) {
    return <EmptyState icon={<GaugeIcon />} title={t('usage.empty')} />;
  }

  // A localized label, falling back to the manifest text — the same rule the Config/Rights tabs use.
  const tr = (key: string, fallback: string) => (t.has(key) ? t(key) : fallback);
  const kindLabel = (kind: Kind) => t(`usage.kind.${kind}`);

  // Only summarise the kinds some service actually declares — an unreported dimension is not shown
  // as a hollow "0" tile (portioned data, no bloat).
  const present = new Set<Kind>(data.services.flatMap((s) => s.metrics.map((m) => m.kind)));
  const totals = new Map(data.kinds.map((k) => [k.kind, k]));

  return (
    <Stack gap={4}>
      <Stack direction="row" gap={3} wrap>
        {KIND_ORDER.filter((k) => present.has(k)).map((kind) => {
          const kt = totals.get(kind);
          const Icon = KIND_ICON[kind];
          return (
            <Stat
              key={kind}
              className="min-w-[10rem] flex-1"
              label={kindLabel(kind)}
              icon={<Icon />}
              value={formatValue((kt?.unit ?? 'count') as Metric['unit'], kt?.total ?? 0, locale)}
            />
          );
        })}
      </Stack>

      {data.services.map((s) => (
        <Panel key={s.service} title={tr(`service.${s.service}`, s.service)} className="p-4">
          <Stack gap={3}>
            {s.metrics.map((m) => {
              const Icon = KIND_ICON[m.kind];
              return (
                <Stack key={m.id} direction="row" align="center" justify="between" gap={3}>
                  <Stack direction="row" align="center" gap={2}>
                    <Icon className="h-4 w-4 text-text-tertiary" />
                    <Text weight="medium">{tr(`usage.metric.${s.service}.${m.id}`, m.label)}</Text>
                  </Stack>
                  <Text weight="semibold" className="tabular-nums">
                    {formatValue(m.unit, m.value, locale)}
                  </Text>
                </Stack>
              );
            })}
          </Stack>
        </Panel>
      ))}
    </Stack>
  );
}
