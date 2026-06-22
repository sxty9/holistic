import { forwardRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from './lib/cn';
import { Spinner } from './primitives';
import { EyeIcon, EyeOffIcon, SearchIcon } from './icons';

const BTN_VARIANT = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover active:bg-accent-hover shadow-elev-1',
  secondary: 'bg-surface-raised text-text-primary border border-separator hover:bg-fill/10 active:bg-fill/15',
  tinted: 'bg-accent/10 text-accent hover:bg-accent/20 active:bg-accent/25',
  ghost: 'text-text-primary hover:bg-fill/10 active:bg-fill/15',
  destructive: 'bg-danger text-white hover:opacity-90 active:opacity-100 shadow-elev-1',
} as const;
const BTN_SIZE = {
  sm: 'h-8 px-3 text-footnote rounded-sm gap-1.5',
  md: 'h-10 px-4 text-subhead rounded-md gap-2',
  lg: 'h-12 px-5 text-body rounded-md gap-2',
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BTN_VARIANT;
  size?: keyof typeof BTN_SIZE;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', loading, iconLeft, iconRight, className, children, disabled, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition-all duration-fast ease-out select-none',
        'active:scale-[0.97] active:duration-[80ms]',
        'disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        BTN_VARIANT[variant],
        BTN_SIZE[size],
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4 text-current" /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: keyof typeof BTN_VARIANT;
  size?: 'sm' | 'md';
  children: ReactNode;
}
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-md transition-all duration-fast ease-out',
        'active:scale-[0.94] active:duration-[80ms]',
        'disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        BTN_VARIANT[variant],
        size === 'sm' ? 'h-8 w-8' : 'h-10 w-10',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});

const inputBase =
  'w-full rounded-md bg-surface-raised border border-separator px-3 text-subhead text-text-primary placeholder:text-text-tertiary ' +
  'shadow-[inset_0_1px_1px_rgba(0,0,0,0.03)] transition-[box-shadow,border-color] duration-fast focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputBase, 'h-10', invalid && 'border-danger focus:ring-danger/40 focus:border-danger', className)} {...rest} />;
});

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea({ invalid, className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(inputBase, 'min-h-32 py-2 leading-relaxed resize-y', invalid && 'border-danger focus:ring-danger/40 focus:border-danger', className)}
      {...rest}
    />
  );
});

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(function PasswordInput({ invalid, className, ...rest }, ref) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        className={cn(inputBase, 'h-10 pr-10', invalid && 'border-danger focus:ring-danger/40 focus:border-danger', className)}
        {...rest}
      />
      <button
        type="button"
        aria-label={show ? 'Hide password' : 'Show password'}
        onClick={() => setShow((v) => !v)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary"
      >
        {show ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
      </button>
    </div>
  );
});

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}
export function Field({ label, hint, error, children, className }: FieldProps) {
  return (
    <label className={cn('flex flex-col gap-1.5', className)}>
      {label && <span className="text-footnote font-medium text-text-secondary">{label}</span>}
      {children}
      {error ? (
        <span className="text-caption text-danger">{error}</span>
      ) : (
        hint && <span className="text-caption text-text-tertiary">{hint}</span>
      )}
    </label>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label?: ReactNode;
  icon?: ReactNode;
  /** Accessible name — required for icon-only segments (no visible text label). */
  'aria-label'?: string;
}
export function SegmentedControl<T extends string>({ options, value, onChange, className }: { options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const n = options.length;
  return (
    <div className={cn('relative inline-grid auto-cols-fr grid-flow-col items-center rounded-md bg-fill/15 p-0.5', className)}>
      {/* The selected pill slides between equal-width segments (iOS segmented control). */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0.5 left-0.5 rounded-sm bg-surface-raised shadow-elev-1 transition-transform duration-base ease-spring"
        style={{ width: `calc((100% - 4px) / ${n})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          aria-label={o['aria-label']}
          title={o['aria-label']}
          onClick={() => onChange(o.value)}
          className={cn(
            'relative z-10 inline-flex h-7 items-center justify-center gap-1.5 px-2.5 text-footnote font-medium transition-colors duration-fast',
            value === o.value ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary',
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SearchField({ value, onChange, placeholder = 'Search', className }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string }) {
  return (
    <div className={cn('relative', className)}>
      <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-tertiary" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(inputBase, 'h-9 pl-8')}
      />
    </div>
  );
}

export function Checkbox({ checked, onChange, className, label }: { checked: boolean; onChange: (v: boolean) => void; className?: string; label?: ReactNode }) {
  return (
    // `relative` anchors the visually-hidden (position:absolute) input to this label, so
    // clicking it focuses an element at the control's own position — otherwise the browser
    // scroll-jumps the page to reach the hidden input's distant containing block.
    <label className={cn('relative inline-flex items-center gap-2 cursor-pointer select-none', className)}>
      <input type="checkbox" className="peer sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={cn(
          'flex h-5 w-5 items-center justify-center rounded-[5px] border transition-colors duration-fast',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50',
          checked ? 'bg-accent border-accent text-accent-fg' : 'border-separator bg-surface-raised',
        )}
      >
        {checked && (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 animate-pop-in" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-11" />
          </svg>
        )}
      </span>
      {label && <span className="text-subhead text-text-primary">{label}</span>}
    </label>
  );
}

export function Switch({ checked, onChange, disabled, label, className }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: ReactNode; className?: string }) {
  return (
    // `relative` anchors the visually-hidden (position:absolute) input to this label, so
    // clicking it focuses an element at the control's own position — otherwise the browser
    // scroll-jumps the page to reach the hidden input's distant containing block.
    <label className={cn('relative inline-flex items-center gap-2.5 select-none', disabled ? 'opacity-50 pointer-events-none' : 'cursor-pointer', className)}>
      <input type="checkbox" role="switch" className="peer sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span
        className={cn(
          'relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors duration-base ease-out',
          'peer-focus-visible:ring-2 peer-focus-visible:ring-accent/50',
          checked ? 'bg-success' : 'bg-fill/40',
        )}
      >
        {/* 51×31 track, 27px knob, 20px travel — the exact iOS toggle geometry. */}
        <span
          className="absolute top-0.5 left-0.5 h-[27px] w-[27px] rounded-full bg-white shadow-elev-1 transition-transform duration-base ease-spring"
          style={{ transform: checked ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </span>
      {label && <span className="text-subhead text-text-primary">{label}</span>}
    </label>
  );
}

export function InlineLink({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('text-footnote font-medium text-accent hover:underline', className)} {...rest} />;
}
