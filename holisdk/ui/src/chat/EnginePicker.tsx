import { useMemo } from 'react';
import { DropdownMenu, type MenuItem } from '../overlay/menu';
import { Button } from '../controls';
import { ChevronDownIcon, CpuIcon } from '../icons';
import { useT } from '../i18n';
import type { ChatEngine, EngineChoice } from './types';

export interface EnginePickerProps {
  engines: ChatEngine[];
  value: EngineChoice | null;
  onChange: (choice: EngineChoice) => void;
  disabled?: boolean;
}

/** EnginePicker is the shared "machine + model" chooser: one dropdown that lists every engine
 *  and, nested under it, its models. It replaces the missing model choice that made the poorer
 *  chat poorer, and is the single control both consumers use. */
export function EnginePicker({ engines, value, onChange, disabled }: EnginePickerProps) {
  const t = useT();

  const currentLabel = useMemo(() => {
    if (!value) return t('chat.model');
    const engine = engines.find((e) => e.id === value.engineId);
    const model = engine?.models.find((m) => m.id === value.modelId);
    return model?.label ?? engine?.label ?? t('chat.model');
  }, [engines, value, t]);

  // A model per engine, grouped: a single engine flattens to a flat list; several engines each
  // become a labelled submenu, so both "one machine, many models" and "many machines" read the
  // same way.
  const items: MenuItem[] = useMemo(() => {
    const modelItem = (engineId: string, engineLabel: string) => (m: { id: string; label: string }): MenuItem => ({
      id: `${engineId}::${m.id}`,
      label: m.label,
      checked: value?.engineId === engineId && value?.modelId === m.id,
      onSelect: () => onChange({ engineId, modelId: m.id }),
    });
    if (engines.length === 1) {
      const e = engines[0];
      return e.models.map(modelItem(e.id, e.label));
    }
    return engines.map((e) => ({
      id: e.id,
      label: e.label,
      icon: <CpuIcon className="h-4 w-4" />,
      submenu: e.models.map(modelItem(e.id, e.label)),
    }));
  }, [engines, value, onChange]);

  return (
    <DropdownMenu
      align="start"
      trigger={
        <Button variant="ghost" size="sm" disabled={disabled || engines.length === 0} iconLeft={<CpuIcon className="h-4 w-4" />} iconRight={<ChevronDownIcon className="h-4 w-4" />}>
          {currentLabel}
        </Button>
      }
      items={items}
    />
  );
}
