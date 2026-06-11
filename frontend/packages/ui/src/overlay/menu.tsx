import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Context from '@radix-ui/react-context-menu';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  onSelect?: () => void;
}

const contentCls =
  'z-50 min-w-[11rem] rounded-md border border-separator bg-surface-raised p-1 shadow-elev-3 ' +
  'backdrop-blur-vibrancy focus:outline-none';
const itemCls =
  'flex items-center gap-2.5 rounded-sm px-2.5 h-8 text-footnote text-text-primary cursor-pointer select-none ' +
  'outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg data-[disabled]:opacity-40 data-[disabled]:pointer-events-none';
const dangerCls = 'text-danger data-[highlighted]:bg-danger data-[highlighted]:text-white';

function renderItems(items: MenuItem[], Item: typeof Dropdown.Item | typeof Context.Item, Sep: typeof Dropdown.Separator | typeof Context.Separator) {
  return items.map((it) => (
    <span key={it.id} className="contents">
      {it.separatorBefore && <Sep className="my-1 h-px bg-separator" />}
      <Item
        disabled={it.disabled}
        onSelect={() => it.onSelect?.()}
        className={cn(itemCls, it.danger && dangerCls)}
      >
        {it.icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>}
        {it.label}
      </Item>
    </span>
  ));
}

export function DropdownMenu({ trigger, items, align = 'end' }: { trigger: ReactNode; items: MenuItem[]; align?: 'start' | 'center' | 'end' }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align={align} sideOffset={6} className={contentCls}>
          {renderItems(items, Dropdown.Item, Dropdown.Separator)}
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}

export function ContextMenu({ items, children }: { items: MenuItem[]; children: ReactNode }) {
  return (
    <Context.Root>
      <Context.Trigger asChild>{children}</Context.Trigger>
      <Context.Portal>
        <Context.Content className={contentCls}>{renderItems(items, Context.Item, Context.Separator)}</Context.Content>
      </Context.Portal>
    </Context.Root>
  );
}
