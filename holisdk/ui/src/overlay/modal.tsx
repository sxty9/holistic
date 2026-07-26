import * as Dialog from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '../lib/cn';
import { IconButton } from '../controls';
import { XIcon } from '../icons';

const overlay =
  'fixed inset-0 z-50 bg-black/30 [backdrop-filter:var(--material-blur-thin)] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out';
// Sheet panels slide for 240ms; stretch the backdrop fade-out to match so it doesn't un-dim early.
const sheetOverlay = cn(overlay, 'data-[state=closed]:[animation-duration:240ms]');

const SIZE = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-2xl' } as const;

export interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  footer?: ReactNode;
  size?: keyof typeof SIZE;
  children?: ReactNode;
  /** Extra classes on the dialog content (e.g. a fixed height for a maximized window). */
  className?: string;
  /** Overrides the body padding (e.g. "p-0" when hosting a component that owns its own padding). */
  bodyClassName?: string;
}

export function Modal({ open, onOpenChange, title, description, footer, size = 'md', children, className, bodyClassName }: ModalProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={overlay} />
        {/* Center via flex (not translate) so the pop-in scale animation doesn't fight a transform. */}
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            className={cn(
              // Cap height to the viewport (the wrapper adds p-4 = 2rem) and lay out as a column so
              // the body scrolls between a pinned header and footer. Without this, tall content
              // overflows the screen with no way to scroll and the footer actions are unreachable.
              'relative flex max-h-[calc(100dvh-2rem)] w-full flex-col',
              'rounded-lg bg-surface-raised border border-separator shadow-elev-3 focus:outline-none',
              'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
              SIZE[size],
              className,
            )}
          >
            {/* Header is always present so the close control is reachable even for a title-less,
                content-only modal (e.g. a maximized reader/composer). */}
            <div className="flex shrink-0 items-start justify-between gap-4 px-5 pt-5">
              <div className="flex flex-col gap-1">
                {title && <Dialog.Title className="text-title3 font-semibold text-text-primary">{title}</Dialog.Title>}
                {description && <Dialog.Description className="text-footnote text-text-secondary">{description}</Dialog.Description>}
              </div>
              <Dialog.Close asChild>
                <IconButton label="Close" size="sm"><XIcon className="h-4 w-4" /></IconButton>
              </Dialog.Close>
            </div>
            {/* min-h-0 lets this flex child shrink below its content's intrinsic height so overflow
                actually scrolls; the header above and footer below keep their natural size. */}
            {children && <div className={cn('min-h-0 flex-1 overflow-y-auto', bodyClassName ?? 'px-5 py-4')}>{children}</div>}
            {footer && <div className="flex shrink-0 justify-end gap-2 px-5 pb-5">{footer}</div>}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const SIDE = {
  right: 'right-0 top-0 h-full w-[min(28rem,90vw)] border-l',
  left: 'left-0 top-0 h-full w-[min(28rem,90vw)] border-r',
} as const;
const SIDE_ANIM = {
  right: 'data-[state=open]:animate-sheet-in-right data-[state=closed]:animate-sheet-out-right',
  left: 'data-[state=open]:animate-sheet-in-left data-[state=closed]:animate-sheet-out-left',
} as const;

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: keyof typeof SIDE;
  title?: ReactNode;
  children?: ReactNode;
}

export function Sheet({ open, onOpenChange, side = 'right', title, children }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={sheetOverlay} />
        <Dialog.Content className={cn('fixed z-50 flex flex-col bg-surface-raised border-separator shadow-elev-3 focus:outline-none', SIDE[side], SIDE_ANIM[side])}>
          <div className="flex items-center justify-between gap-4 px-5 h-14 border-b border-separator shrink-0">
            {title && <Dialog.Title className="text-subhead font-semibold text-text-primary truncate">{title}</Dialog.Title>}
            <Dialog.Close asChild>
              <IconButton label="Close" size="sm"><XIcon className="h-4 w-4" /></IconButton>
            </Dialog.Close>
          </div>
          <div className="flex-1 min-h-0 overflow-auto">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
