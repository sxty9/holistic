import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { cn } from './lib/cn';
import { Avatar } from './primitives';
import { IconButton } from './controls';
import { DropdownMenu, type MenuItem } from './overlay/menu';
import { MoonIcon, SignOutIcon, SunIcon, UserIcon } from './icons';
import type { HolisticUser } from './plugin/contract';

// --- theme ---------------------------------------------------------------

type Theme = 'light' | 'dark';

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
  try {
    localStorage.setItem('holistic-theme', t);
  } catch {
    /* ignore */
  }
}

export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('holistic-theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {
      /* ignore */
    }
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });
  useEffect(() => applyTheme(theme), [theme]);
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))];
}

// --- shell ---------------------------------------------------------------

export interface AppShellProps {
  sidebar: ReactNode;
  topBar: ReactNode;
  children: ReactNode;
}
export function AppShell({ sidebar, topBar, children }: AppShellProps) {
  return (
    <div className="flex h-full w-full bg-bg-base text-text-primary">
      <aside className="w-[248px] shrink-0 bg-surface-sidebar [backdrop-filter:var(--blur-vibrancy)] border-r border-separator flex flex-col">
        {sidebar}
      </aside>
      <div className="flex flex-1 flex-col min-w-0">
        {topBar}
        <main className="flex-1 min-h-0 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export interface SidebarServiceItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}
export interface SidebarProps {
  items: SidebarServiceItem[];
  activeId?: string;
  onSelect: (id: string) => void;
  header?: ReactNode;
  footer?: ReactNode;
}
export function Sidebar({ items, activeId, onSelect, header, footer }: SidebarProps) {
  return (
    <>
      {header && <div className="px-4 h-14 flex items-center shrink-0">{header}</div>}
      <nav className="flex-1 min-h-0 overflow-auto px-2 py-2 flex flex-col gap-0.5">
        {items.map((it) => {
          const Icon = it.icon;
          const active = it.id === activeId;
          return (
            <button
              key={it.id}
              type="button"
              onClick={() => onSelect(it.id)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 h-9 text-subhead transition-colors duration-fast text-left',
                active ? 'bg-accent text-accent-fg font-medium shadow-elev-1' : 'text-text-secondary hover:bg-text-tertiary/10 hover:text-text-primary',
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{it.label}</span>
            </button>
          );
        })}
      </nav>
      {footer && <div className="px-2 py-2 shrink-0 border-t border-separator">{footer}</div>}
    </>
  );
}

export interface TopBarProps {
  title?: ReactNode;
  actions?: ReactNode;
  user: HolisticUser;
  onSignOut: () => void;
  onChangePassword?: () => void;
}
export function TopBar({ title, actions, user, onSignOut, onChangePassword }: TopBarProps) {
  const [theme, toggleTheme] = useTheme();
  const items: MenuItem[] = [
    { id: 'theme', label: theme === 'dark' ? 'Light appearance' : 'Dark appearance', icon: theme === 'dark' ? <SunIcon /> : <MoonIcon />, onSelect: toggleTheme },
    ...(onChangePassword ? [{ id: 'pw', label: 'Change password', icon: <UserIcon />, onSelect: onChangePassword }] : []),
    { id: 'signout', label: 'Sign out', icon: <SignOutIcon />, danger: true, separatorBefore: true, onSelect: onSignOut },
  ];
  return (
    <header className="h-14 shrink-0 flex items-center justify-between gap-4 px-5 border-b border-separator bg-surface [backdrop-filter:var(--blur-thin)]">
      <div className="text-title3 font-semibold text-text-primary truncate">{title}</div>
      <div className="flex items-center gap-2">
        {actions}
        <DropdownMenu
          align="end"
          trigger={
            <IconButton label="Account">
              <Avatar name={user.displayName || user.username} size={28} />
            </IconButton>
          }
          items={items}
        />
      </div>
    </header>
  );
}

export interface ContentRegionProps {
  children: ReactNode;
  className?: string;
}
export function ContentRegion({ children, className }: ContentRegionProps) {
  return <div className={cn('mx-auto w-full max-w-6xl px-6 py-6', className)}>{children}</div>;
}
