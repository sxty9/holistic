import type { ReactNode } from 'react';
import { cn } from './lib/cn';
import { Panel, Stack, Text } from './primitives';

export interface StatDelta {
  value: ReactNode;
  tone?: 'success' | 'danger' | 'secondary';
}

export interface StatProps {
  label: ReactNode;
  value: ReactNode;
  /** Small suffix after the value, e.g. "%", "GB". */
  unit?: ReactNode;
  /** Small leading/trailing glyph (an @holistic/ui icon). */
  icon?: ReactNode;
  delta?: StatDelta;
  /** Anything below the value — a Sparkline, ProgressBar, or caption. */
  footer?: ReactNode;
  className?: string;
}

const DELTA_COLOR = { success: 'success', danger: 'danger', secondary: 'secondary' } as const;

/** A KPI tile: label, big number (+ unit/delta), optional trailing footer (sparkline/bar). */
export function Stat({ label, value, unit, icon, delta, footer, className }: StatProps) {
  return (
    <Panel className={cn('p-4', className)}>
      <Stack gap={2}>
        <Stack direction="row" align="center" justify="between" gap={2}>
          <Text variant="footnote" color="secondary" weight="medium">{label}</Text>
          {icon && <span className="text-text-tertiary [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        </Stack>
        <Stack direction="row" align="baseline" gap={1}>
          <Text variant="title1" weight="bold" className="tabular-nums">{value}</Text>
          {unit && <Text variant="subhead" color="secondary">{unit}</Text>}
          {delta && (
            <Text variant="footnote" color={DELTA_COLOR[delta.tone ?? 'secondary']} weight="medium" className="ml-1">
              {delta.value}
            </Text>
          )}
        </Stack>
        {footer}
      </Stack>
    </Panel>
  );
}
