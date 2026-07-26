import { useState } from 'react';
import { cn } from './lib/cn';
import { IconButton } from './controls';
import { CheckIcon, CopyIcon } from './icons';

/** Copyable preformatted code block (the only sanctioned way for a service to show code). */
export function CodeBlock({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }
  return (
    <div className={cn('relative rounded-md border border-separator bg-surface', className)}>
      <pre className="overflow-auto p-3 pr-11 font-mono text-caption leading-relaxed text-text-primary whitespace-pre">{code}</pre>
      <div className="absolute right-1.5 top-1.5">
        <IconButton label={copied ? 'Copied' : 'Copy'} size="sm" onClick={copy}>
          {copied ? <CheckIcon className="h-4 w-4 text-success" /> : <CopyIcon className="h-4 w-4" />}
        </IconButton>
      </div>
    </div>
  );
}
