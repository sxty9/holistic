import * as Dialog from '@radix-ui/react-dialog';
import { cn } from '../lib/cn';
import { Button, IconButton } from '../controls';
import { EmptyState } from '../primitives';
import { DownloadIcon, XIcon } from '../icons';
import type { FileEntry } from '../plugin/contract';
import { FileEntryIcon } from './parts';

export interface TextPayload {
  content: string;
  truncated?: boolean;
}

export interface FilePreviewProps {
  open: boolean;
  entry: FileEntry | null;
  /** URL for inline media (image/audio/video/pdf), from api.url('fs/raw?path=…'). */
  rawUrl?: string;
  /** Preloaded text for text/markdown viewers. */
  text?: TextPayload | null;
  onOpenChange: (open: boolean) => void;
  onDownload: (entry: FileEntry) => void;
}

function Body({ entry, rawUrl, text, onDownload }: { entry: FileEntry; rawUrl?: string; text?: TextPayload | null; onDownload: (e: FileEntry) => void }) {
  const v = entry.viewer;
  if (v === 'image' && rawUrl) {
    return (
      <div className="flex items-center justify-center bg-black/40 max-h-[70vh] overflow-auto">
        <img src={rawUrl} alt={entry.name} className="max-h-[70vh] max-w-full object-contain" />
      </div>
    );
  }
  if (v === 'video' && rawUrl) {
    return (
      <div className="bg-black flex items-center justify-center max-h-[70vh]">
        <video src={rawUrl} controls className="max-h-[70vh] max-w-full" />
      </div>
    );
  }
  if (v === 'audio' && rawUrl) {
    return (
      <div className="flex flex-col items-center gap-4 p-10">
        <FileEntryIcon entry={entry} className="h-16 w-16" />
        <audio src={rawUrl} controls className="w-full" />
      </div>
    );
  }
  if (v === 'pdf' && rawUrl) {
    return <object data={rawUrl} type="application/pdf" className="w-full h-[70vh]" aria-label={entry.name} />;
  }
  if ((v === 'text' || v === 'markdown') && text) {
    return (
      <div className="max-h-[70vh] overflow-auto bg-surface">
        {text.truncated && <div className="px-4 py-2 text-caption text-warning border-b border-separator">Showing the beginning of a large file.</div>}
        <pre className="p-4 font-mono text-footnote text-text-primary whitespace-pre-wrap break-words">{text.content}</pre>
      </div>
    );
  }
  return (
    <EmptyState
      icon={<FileEntryIcon entry={entry} className="h-10 w-10" />}
      title="Preview not available"
      description="This file type can’t be previewed here."
      action={
        <Button variant="primary" size="sm" iconLeft={<DownloadIcon className="h-4 w-4" />} onClick={() => onDownload(entry)}>
          Download
        </Button>
      }
    />
  );
}

/** Standardized viewer host — the only sanctioned way to render file content. */
export function FilePreview({ open, entry, rawUrl, text, onOpenChange, onDownload }: FilePreviewProps) {
  return (
    <Dialog.Root open={open && !!entry} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 [backdrop-filter:var(--material-blur-thin)] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            className={cn(
              'relative w-full max-w-4xl',
              'rounded-lg bg-surface-raised border border-separator shadow-elev-3 overflow-hidden focus:outline-none',
              'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
            )}
          >
          <div className="flex items-center justify-between gap-4 px-4 h-12 border-b border-separator">
            <Dialog.Title className="text-subhead font-semibold text-text-primary truncate">{entry?.name}</Dialog.Title>
            <div className="flex items-center gap-1">
              {entry && (
                <IconButton label="Download" size="sm" onClick={() => onDownload(entry)}>
                  <DownloadIcon className="h-4 w-4" />
                </IconButton>
              )}
              <Dialog.Close asChild>
                <IconButton label="Close" size="sm">
                  <XIcon className="h-4 w-4" />
                </IconButton>
              </Dialog.Close>
            </div>
          </div>
          {entry && <Body entry={entry} rawUrl={rawUrl} text={text} onDownload={onDownload} />}
          </Dialog.Content>
        </div>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
