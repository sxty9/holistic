import { forwardRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from './lib/cn';
import { Spinner } from './primitives';
import { EyeIcon, EyeOffIcon, SearchIcon } from './icons';

const BTN_VARIANT = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover shadow-elev-1',
  secondary: 'bg-surface-raised text-text-primary border border-separator hover:bg-text-tertiary/10',
  ghost: 'text-text-primary hover:bg-text-tertiary/10',
  destructive: 'bg-danger text-white hover:opacity-90 shadow-elev-1',
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
        'inline-flex items-center justify-center font-medium transition-colors duration-fast ease-out select-none',
        'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
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
        'inline-flex items-center justify-center rounded-md transition-colors duration-fast ease-out',
        'disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
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
  'transition-shadow duration-fast focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input({ invalid, className, ...rest }, ref) {
  return <input ref={ref} className={cn(inputBase, 'h-10', invalid && 'border-danger focus:ring-danger/40 focus:border-danger', className)} {...rest} />;
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
}
export function SegmentedControl<T extends string>({ options, value, onChange, className }: { options: SegmentedOption<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cn('inline-flex items-center gap-0.5 rounded-md bg-text-tertiary/15 p-0.5', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-sm px-2.5 h-7 text-footnote font-medium transition-colors duration-fast',
            value === o.value ? 'bg-surface-raised text-text-primary shadow-elev-1' : 'text-text-secondary hover:text-text-primary',
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
    <label className={cn('inline-flex items-center gap-2 cursor-pointer select-none', className)}>
      <span
        className={cn('flex h-5 w-5 items-center justify-center rounded border transition-colors', checked ? 'bg-accent border-accent text-accent-fg' : 'border-separator bg-surface-raised')}
      >
        {checked && (
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 5 5 9-11" />
          </svg>
        )}
      </span>
      <input type="checkbox" className="sr-only" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label && <span className="text-subhead text-text-primary">{label}</span>}
    </label>
  );
}

export function InlineLink({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cn('text-footnote font-medium text-accent hover:underline', className)} {...rest} />;
}
