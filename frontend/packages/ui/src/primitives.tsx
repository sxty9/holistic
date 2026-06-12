import type { CSSProperties, ElementType, HTMLAttributes, ReactNode } from 'react';
import { cn } from './lib/cn';

// Literal class maps (never build Tailwind class names dynamically — the scanner needs them whole).
const DIR = { row: 'flex-row', col: 'flex-col' } as const;
const ALIGN = { start: 'items-start', center: 'items-center', end: 'items-end', stretch: 'items-stretch', baseline: 'items-baseline' } as const;
const JUSTIFY = { start: 'justify-start', center: 'justify-center', end: 'justify-end', between: 'justify-between', around: 'justify-around' } as const;

export interface StackProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  direction?: keyof typeof DIR;
  gap?: number; // multiples of 4px
  align?: keyof typeof ALIGN;
  justify?: keyof typeof JUSTIFY;
  wrap?: boolean;
  grow?: boolean;
}

export function Stack({ as: As = 'div', direction = 'col', gap = 0, align, justify, wrap, grow, className, style, ...rest }: StackProps) {
  const s: CSSProperties = { ...style };
  if (gap) s.gap = `${gap * 4}px`;
  return (
    <As
      className={cn('flex', DIR[direction], align && ALIGN[align], justify && JUSTIFY[justify], wrap && 'flex-wrap', grow && 'flex-1 min-h-0', className)}
      style={s}
      {...rest}
    />
  );
}

export interface BoxProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  p?: number;
}
export function Box({ as: As = 'div', p, className, style, ...rest }: BoxProps) {
  const s: CSSProperties = { ...style };
  if (p) s.padding = `${p * 4}px`;
  return <As className={className} style={s} {...rest} />;
}

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  gap?: number;
  minItemWidth?: number; // px; enables responsive auto-fill grid
  cols?: number;
}
export function Grid({ gap = 4, minItemWidth, cols, className, style, ...rest }: GridProps) {
  const s: CSSProperties = { ...style, gap: `${gap * 4}px` };
  if (minItemWidth) s.gridTemplateColumns = `repeat(auto-fill, minmax(${minItemWidth}px, 1fr))`;
  else if (cols) s.gridTemplateColumns = `repeat(${cols}, minmax(0, 1fr))`;
  return <div className={cn('grid', className)} style={s} {...rest} />;
}

export interface PanelProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode;
  actions?: ReactNode;
  elevation?: 1 | 2 | 3;
  /** Lift on hover — for clickable cards. Off by default so static panels don't move. */
  interactive?: boolean;
}
const ELEV = { 1: 'shadow-elev-1', 2: 'shadow-elev-2', 3: 'shadow-elev-3' } as const;
export function Panel({ title, actions, elevation = 1, interactive, className, children, ...rest }: PanelProps) {
  return (
    <div
      className={cn(
        'rounded-card bg-surface-raised border border-separator',
        ELEV[elevation],
        interactive && 'transition-all duration-base ease-out hover:-translate-y-0.5 hover:shadow-elev-2',
        className,
      )}
      {...rest}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-separator">
          {title && <div className="text-subhead font-semibold text-text-primary">{title}</div>}
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}

const TEXT_VARIANT = {
  largeTitle: 'text-largeTitle font-bold',
  title1: 'text-title1 font-bold',
  title2: 'text-title2 font-semibold',
  title3: 'text-title3 font-semibold',
  body: 'text-body',
  subhead: 'text-subhead',
  footnote: 'text-footnote',
  caption: 'text-caption',
} as const;
const TEXT_COLOR = {
  primary: 'text-text-primary',
  secondary: 'text-text-secondary',
  tertiary: 'text-text-tertiary',
  accent: 'text-accent',
  danger: 'text-danger',
  success: 'text-success',
} as const;
const WEIGHT = { normal: 'font-normal', medium: 'font-medium', semibold: 'font-semibold', bold: 'font-bold' } as const;

export interface TextProps extends HTMLAttributes<HTMLElement> {
  as?: ElementType;
  variant?: keyof typeof TEXT_VARIANT;
  color?: keyof typeof TEXT_COLOR;
  weight?: keyof typeof WEIGHT;
  truncate?: boolean;
}
export function Text({ as: As = 'span', variant = 'body', color = 'primary', weight, truncate, className, ...rest }: TextProps) {
  return <As className={cn(TEXT_VARIANT[variant], TEXT_COLOR[color], weight && WEIGHT[weight], truncate && 'truncate', className)} {...rest} />;
}

export interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  level?: 1 | 2 | 3;
  variant?: keyof typeof TEXT_VARIANT;
}
export function Heading({ level = 1, variant, className, ...rest }: HeadingProps) {
  const Tag = (`h${level}`) as ElementType;
  const v = variant ?? (level === 1 ? 'title1' : level === 2 ? 'title2' : 'title3');
  return <Tag className={cn(TEXT_VARIANT[v], 'text-text-primary', className)} {...rest} />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn('border-0 border-t border-separator', className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('h-5 w-5 animate-spin text-text-secondary', className)} viewBox="0 0 24 24" fill="none" aria-label="Loading">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

const BADGE = {
  neutral: 'bg-fill/20 text-text-secondary',
  accent: 'bg-accent/15 text-accent',
  success: 'bg-success/15 text-success',
  danger: 'bg-danger/15 text-danger',
} as const;
export function Badge({ variant = 'neutral', className, children }: { variant?: keyof typeof BADGE; className?: string; children: ReactNode }) {
  return <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-caption font-medium', BADGE[variant], className)}>{children}</span>;
}

export function ProgressBar({ value, indeterminate, className }: { value?: number; indeterminate?: boolean; className?: string }) {
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-fill/20', className)}>
      <div
        className={cn('h-full rounded-full bg-accent transition-[width] duration-base ease-out', indeterminate && 'w-1/3 animate-pulse')}
        style={indeterminate ? undefined : { width: `${Math.max(0, Math.min(100, value ?? 0))}%` }}
      />
    </div>
  );
}

export function ScrollArea({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('overflow-auto', className)} {...rest}>{children}</div>;
}

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const initials = name.trim().slice(0, 2).toUpperCase();
  return (
    <div
      className={cn('inline-flex items-center justify-center rounded-full bg-accent/15 text-accent font-semibold select-none', className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </div>
  );
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 px-6 py-16 text-center', className)}>
      {icon && <div className="text-text-tertiary [&>svg]:h-10 [&>svg]:w-10">{icon}</div>}
      <div className="text-subhead font-semibold text-text-primary">{title}</div>
      {description && <div className="text-footnote text-text-secondary max-w-sm">{description}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
