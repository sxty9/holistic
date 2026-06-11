import { useRef, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from '../controls';
import { ChevronRightIcon, FileIcon, FileTextIcon, FolderIcon, ImageIcon, MusicIcon, PdfIcon, UploadIcon, VideoIcon } from '../icons';
import type { FileEntry } from '../plugin/contract';

export function FileEntryIcon({ entry, className }: { entry: FileEntry; className?: string }) {
  if (entry.kind === 'dir') return <FolderIcon className={cn('text-accent', className)} />;
  const v = entry.viewer;
  const Cmp =
    v === 'image' ? ImageIcon : v === 'audio' ? MusicIcon : v === 'video' ? VideoIcon : v === 'pdf' ? PdfIcon : v === 'text' || v === 'markdown' ? FileTextIcon : FileIcon;
  return <Cmp className={cn('text-text-secondary', className)} />;
}

export interface BreadcrumbSegment {
  label: string;
  path: string;
}
export function Breadcrumb({ segments, onNavigate }: { segments: BreadcrumbSegment[]; onNavigate: (path: string) => void }) {
  return (
    <nav className="flex items-center gap-0.5 min-w-0">
      {segments.map((s, i) => (
        <span key={s.path} className="flex items-center gap-0.5 min-w-0">
          {i > 0 && <ChevronRightIcon className="h-4 w-4 text-text-tertiary shrink-0" />}
          <button
            type="button"
            onClick={() => onNavigate(s.path)}
            className={cn(
              'truncate rounded px-1.5 py-0.5 text-subhead transition-colors hover:bg-text-tertiary/10',
              i === segments.length - 1 ? 'text-text-primary font-semibold' : 'text-text-secondary',
            )}
          >
            {s.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

/** Hidden file input fronted by a Button; emits the chosen File[]. */
export function UploadControl({
  onFiles,
  label = 'Upload',
  icon = <UploadIcon className="h-4 w-4" />,
  variant = 'secondary',
}: {
  onFiles: (files: File[]) => void;
  label?: ReactNode;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          if (files.length) onFiles(files);
          e.target.value = '';
        }}
      />
      <Button variant={variant} size="sm" iconLeft={icon} onClick={() => ref.current?.click()}>
        {label}
      </Button>
    </>
  );
}
