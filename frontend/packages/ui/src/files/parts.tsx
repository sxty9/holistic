import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';
import { Button } from '../controls';
import { ChevronRightIcon, FileIcon, FileTextIcon, FolderIcon, ImageIcon, MusicIcon, PdfIcon, UploadIcon, VideoIcon } from '../icons';
import { useT } from '../i18n';
import type { FileEntry } from '../plugin/contract';
import type { TextPayload } from './viewers';

export function FileEntryIcon({ entry, className }: { entry: FileEntry; className?: string }) {
  if (entry.kind === 'dir') return <FolderIcon className={cn('text-accent', className)} />;
  const v = entry.viewer;
  const Cmp =
    v === 'image' ? ImageIcon : v === 'audio' ? MusicIcon : v === 'video' ? VideoIcon : v === 'pdf' ? PdfIcon : v === 'text' || v === 'markdown' ? FileTextIcon : FileIcon;
  return <Cmp className={cn('text-text-secondary', className)} />;
}

/** How FileThumb reaches file content to render live previews. Wired by the host service
 *  (never a raw <img>/fetch in a service — the SDK owns media rendering). */
export interface FileThumbSources {
  /** Inline media URL for image/video thumbnails, e.g. api.url('fs/raw?path=…'). */
  mediaUrl?: (entry: FileEntry) => string;
  /** Lazily fetch text for text/markdown previews, e.g. api.get('fs/text?path=…'). */
  loadText?: (entry: FileEntry) => Promise<TextPayload>;
}

// Don't pull large files just to paint a tiny grid preview — above this the icon is shown instead.
const TEXT_PREVIEW_MAX_BYTES = 256 * 1024;
const TEXT_PREVIEW_CHARS = 800;

/** A lazily-loaded text/markdown "page" preview; renders the icon until it scrolls into view. */
function TextThumb({ entry, load, fallback, className }: { entry: FileEntry; load: (e: FileEntry) => Promise<TextPayload>; fallback: ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const el = ref.current;
    const fetchText = () =>
      load(entry)
        .then((p) => !cancelled && setText(p.content.slice(0, TEXT_PREVIEW_CHARS)))
        .catch(() => !cancelled && setFailed(true));
    if (!el || typeof IntersectionObserver === 'undefined') {
      void fetchText();
      return () => {
        cancelled = true;
      };
    }
    const io = new IntersectionObserver(
      (entries, obs) => {
        if (entries.some((e) => e.isIntersecting)) {
          obs.disconnect();
          void fetchText();
        }
      },
      { rootMargin: '200px' },
    );
    io.observe(el);
    return () => {
      cancelled = true;
      io.disconnect();
    };
    // Re-fetch only when the underlying file changes; `load` identity may vary each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entry.path]);

  if (failed) return <div className="flex h-full w-full items-center justify-center">{fallback}</div>;
  const empty = text != null && text.trim() === '';
  return (
    <div ref={ref} className={cn('flex h-full w-full overflow-hidden rounded-md border border-separator bg-surface', className)}>
      {text == null || empty ? (
        <div className="m-auto opacity-60">{fallback}</div>
      ) : (
        <pre className="max-h-full w-full overflow-hidden whitespace-pre-wrap break-words px-2 py-1.5 text-left font-mono text-[7px] leading-[1.35] text-text-secondary">{text}</pre>
      )}
    </div>
  );
}

/** Fills a square/box with a rendered preview of the file — a real image/video thumbnail or a
 *  text/markdown page — falling back to {@link FileEntryIcon} for folders, other types, and on
 *  load error. `withText` gates the (fetch-backed) text preview to roomy layouts like the grid. */
export function FileThumb({
  entry,
  sources,
  withText,
  iconClassName,
  className,
}: {
  entry: FileEntry;
  sources?: FileThumbSources;
  withText?: boolean;
  /** Size classes for the fallback icon (e.g. "h-12 w-12"). */
  iconClassName?: string;
  /** Extra classes for the fill element. */
  className?: string;
}) {
  const [mediaFailed, setMediaFailed] = useState(false);
  const v = entry.viewer;
  const icon = <FileEntryIcon entry={entry} className={iconClassName} />;

  if (entry.kind === 'file' && !mediaFailed && sources?.mediaUrl && (v === 'image' || v === 'video')) {
    const src = sources.mediaUrl(entry);
    return (
      <div className={cn('flex h-full w-full items-center justify-center overflow-hidden rounded-md bg-fill/5', className)}>
        {v === 'image' ? (
          <img src={src} alt="" loading="lazy" onError={() => setMediaFailed(true)} className="h-full w-full object-cover" />
        ) : (
          // #t=0.1 nudges the browser to paint an early frame as the poster.
          <video src={`${src}#t=0.1`} muted playsInline preload="metadata" onError={() => setMediaFailed(true)} className="h-full w-full object-cover" />
        )}
      </div>
    );
  }

  if (entry.kind === 'file' && withText && sources?.loadText && (v === 'text' || v === 'markdown') && entry.size <= TEXT_PREVIEW_MAX_BYTES) {
    return <TextThumb entry={entry} load={sources.loadText} fallback={icon} className={className} />;
  }

  return <div className={cn('flex h-full w-full items-center justify-center', className)}>{icon}</div>;
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
              'truncate rounded px-1.5 py-0.5 text-subhead transition-colors hover:bg-fill/10',
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
  label,
  icon = <UploadIcon className="h-4 w-4" />,
  variant = 'secondary',
}: {
  onFiles: (files: File[]) => void;
  label?: ReactNode;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const t = useT();
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
        {label ?? t('common.upload')}
      </Button>
    </>
  );
}
