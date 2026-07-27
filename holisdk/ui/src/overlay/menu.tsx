import * as Dropdown from '@radix-ui/react-dropdown-menu';
import * as Context from '@radix-ui/react-context-menu';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { CheckIcon, ChevronRightIcon } from '../icons';

export interface MenuItem {
  id: string;
  label: ReactNode;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  /** Show a trailing checkmark (e.g. the active option in a choice group). */
  checked?: boolean;
  /** Nested items — renders this entry as an expandable submenu. */
  submenu?: MenuItem[];
  onSelect?: () => void;
}

const contentCls =
  'z-50 min-w-[11rem] rounded-md border border-separator bg-material-thick [backdrop-filter:var(--material-blur)] p-1 shadow-elev-3 focus:outline-none ' +
  'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out';
const itemCls =
  'flex items-center gap-2.5 rounded-sm px-2.5 h-8 text-footnote text-text-primary cursor-pointer select-none ' +
  'outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-fg data-[disabled]:opacity-40 data-[disabled]:pointer-events-none';
const dangerCls = 'text-danger data-[highlighted]:bg-danger data-[highlighted]:text-white';

// Each menu kind (dropdown / context) supplies its own Radix primitives so one
// renderer covers both, including nested submenus.
interface MenuPrimitives {
  Item: typeof Dropdown.Item | typeof Context.Item;
  Sep: typeof Dropdown.Separator | typeof Context.Separator;
  Sub: typeof Dropdown.Sub | typeof Context.Sub;
  SubTrigger: typeof Dropdown.SubTrigger | typeof Context.SubTrigger;
  SubContent: typeof Dropdown.SubContent | typeof Context.SubContent;
  Portal: typeof Dropdown.Portal | typeof Context.Portal;
}

function renderItems(items: MenuItem[], p: MenuPrimitives): ReactNode {
  const { Item, Sep, Sub, SubTrigger, SubContent, Portal } = p;
  return items.map((it) => (
    <span key={it.id} className="contents">
      {it.separatorBefore && <Sep className="my-1 h-px bg-separator" />}
      {it.submenu ? (
        <Sub>
          <SubTrigger className={cn(itemCls, it.danger && dangerCls)}>
            {it.icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>}
            {it.label}
            <ChevronRightIcon className="ml-auto h-4 w-4 opacity-60" />
          </SubTrigger>
          <Portal>
            <SubContent
              sideOffset={2}
              alignOffset={-4}
              className={cn(contentCls, 'origin-[var(--radix-dropdown-menu-content-transform-origin)]')}
            >
              {renderItems(it.submenu, p)}
            </SubContent>
          </Portal>
        </Sub>
      ) : (
        <Item disabled={it.disabled} onSelect={() => it.onSelect?.()} className={cn(itemCls, it.danger && dangerCls)}>
          {it.icon && <span className="[&>svg]:h-4 [&>svg]:w-4">{it.icon}</span>}
          {it.label}
          {it.checked && <CheckIcon className="ml-auto h-4 w-4 text-accent" />}
        </Item>
      )}
    </span>
  ));
}

const DROPDOWN: MenuPrimitives = {
  Item: Dropdown.Item,
  Sep: Dropdown.Separator,
  Sub: Dropdown.Sub,
  SubTrigger: Dropdown.SubTrigger,
  SubContent: Dropdown.SubContent,
  Portal: Dropdown.Portal,
};
const CONTEXT: MenuPrimitives = {
  Item: Context.Item,
  Sep: Context.Separator,
  Sub: Context.Sub,
  SubTrigger: Context.SubTrigger,
  SubContent: Context.SubContent,
  Portal: Context.Portal,
};

export function DropdownMenu({ trigger, items, align = 'end' }: { trigger: ReactNode; items: MenuItem[]; align?: 'start' | 'center' | 'end' }) {
  return (
    <Dropdown.Root>
      <Dropdown.Trigger asChild>{trigger}</Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content align={align} sideOffset={6} className={cn(contentCls, 'origin-[var(--radix-dropdown-menu-content-transform-origin)]')}>
          {renderItems(items, DROPDOWN)}
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
        <Context.Content className={cn(contentCls, 'origin-[var(--radix-context-menu-content-transform-origin)]')}>{renderItems(items, CONTEXT)}</Context.Content>
      </Context.Portal>
    </Context.Root>
  );
}
