import { type ReactNode } from 'react';
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
            'radial-gradient(60rem 40rem at 20% -10%, rgba(10,132,255,0.22), transparent 60%), radial-gradient(50rem 40rem at 110% 110%, rgba(52,199,89,0.16), transparent 55%), radial-gradient(44rem 32rem at 50% 122%, rgba(255,201,87,0.16), transparent 60%)',
        }}
      />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}

/** Frosted card holding the auth form. */
export function AuthCard({ logo, title, subtitle, children, className }: { logo?: ReactNode; title: ReactNode; subtitle?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-separator bg-material-thick [backdrop-filter:var(--material-blur)] shadow-elev-3 p-7', className)}>
      <div className="flex flex-col items-center gap-2 mb-6 text-center">
        {logo}
        <h1 className="text-title2 font-semibold text-text-primary">{title}</h1>
        {subtitle && <p className="text-footnote text-text-secondary">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
