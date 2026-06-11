import type { ReactNode } from 'react';
import { cn } from './lib/cn';

/** Full-bleed backdrop for the login / register screens. */
export function AuthScene({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-full w-full flex items-center justify-center p-6 bg-bg-base overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(60rem 40rem at 20% -10%, rgba(10,132,255,0.22), transparent 60%), radial-gradient(50rem 40rem at 110% 110%, rgba(52,199,89,0.16), transparent 55%)',
        }}
      />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}

/** Frosted card holding the auth form. */
export function AuthCard({ logo, title, subtitle, children, className }: { logo?: ReactNode; title: ReactNode; subtitle?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-separator bg-surface-raised/90 [backdrop-filter:var(--blur-vibrancy)] shadow-elev-3 p-7', className)}>
      <div className="flex flex-col items-center gap-2 mb-6 text-center">
        {logo}
        <h1 className="text-title2 font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="text-footnote text-text-secondary">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** The Holistic wordmark / app glyph. */
export function HolisticMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex h-12 w-12 items-center justify-center rounded-2xl bg-accent text-accent-fg shadow-elev-2', className)}>
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M8 12h8M12 8v8" />
      </svg>
    </div>
  );
}
