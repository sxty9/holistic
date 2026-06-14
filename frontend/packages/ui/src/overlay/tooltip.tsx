import * as RT from '@radix-ui/react-tooltip';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

const tipCls =
  'z-50 max-w-xs rounded-sm border border-separator bg-material-thick [backdrop-filter:var(--material-blur)] px-2 py-1 ' +
  'text-caption text-text-primary shadow-elev-2 select-none ' +
  'data-[state=delayed-open]:animate-pop-in data-[state=instant-open]:animate-pop-in data-[state=closed]:animate-pop-out';

export interface TooltipProps {
  /** Hover content. When empty/nullish the tooltip is suppressed. */
  content: ReactNode;
  /** Single element child (rendered via Radix `asChild`). */
  children: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  delay?: number;
  /** Force-disable (e.g. only show when text is truncated). */
  disabled?: boolean;
  className?: string;
}

/** Lightweight hover tooltip (Radix). Self-contained Provider so it can be dropped
 *  anywhere without mounting a global provider. */
export function Tooltip({ content, children, side = 'top', delay = 300, disabled, className }: TooltipProps) {
  if (disabled || content == null || content === '') return <>{children}</>;
  return (
    <RT.Provider delayDuration={delay} skipDelayDuration={200}>
      <RT.Root>
        <RT.Trigger asChild>{children}</RT.Trigger>
        <RT.Portal>
          <RT.Content side={side} sideOffset={6} collisionPadding={8} className={cn(tipCls, className)}>
            {content}
          </RT.Content>
        </RT.Portal>
      </RT.Root>
    </RT.Provider>
  );
}
