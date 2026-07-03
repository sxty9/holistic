import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { cn } from '../lib/cn';
import { Button, IconButton } from '../controls';
import { EmptyState } from '../primitives';
import { Modal } from '../overlay/modal';
import { ChevronLeftIcon, ChevronRightIcon, DownloadIcon, XIcon } from '../icons';
import { useT } from '../i18n';
import type { FileEntry } from '../plugin/contract';
import { FileEntryIcon } from './parts';
import { viewerActions, type FileViewerAction, type FileViewerActionHost } from './viewerActions';

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
  /** Navigate to the previous item, if any. Renders a "<" control (also bound to ArrowLeft). */
  onPrev?: () => void;
  /** Navigate to the next item, if any. Renders a ">" control (also bound to ArrowRight). */
  onNext?: () => void;
  /** When provided, the viewer renders registered file-viewer actions (e.g. aigentic's "Ask AI")
   *  for the shown file — a button per applicable action, mounting its panel on click. The host
   *  supplies the service-context bridges plus a raw-bytes loader for the current file; text is
   *  taken from `text`. Omit to render no actions. The viewer never imports any specific action. */
  actionHost?: FileViewerActionHost;
}

function Body({ entry, rawUrl, text, onDownload }: { entry: FileEntry; rawUrl?: string; text?: TextPayload | null; onDownload: (e: FileEntry) => void }) {
  const t = useT();
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
        {text.truncated && <div className="px-4 py-2 text-caption text-warning border-b border-separator">{t('files.largeFileHead')}</div>}
        <pre className="p-4 font-mono text-footnote text-text-primary whitespace-pre-wrap break-words">{text.content}</pre>
      </div>
    );
  }
  return (
    <EmptyState
      icon={<FileEntryIcon entry={entry} className="h-10 w-10" />}
      title={t('files.previewUnavailable')}
      description={t('files.previewUnavailableHint')}
      action={
        <Button variant="primary" size="sm" iconLeft={<DownloadIcon className="h-4 w-4" />} onClick={() => onDownload(entry)}>
          {t('common.download')}
        </Button>
      }
    />
  );
}

/** Standardized viewer host — the only sanctioned way to render file content. */
export function FilePreview({ open, entry, rawUrl, text, onOpenChange, onDownload, onPrev, onNext, actionHost }: FilePreviewProps) {
  const t = useT();
  const navigable = !!onPrev || !!onNext;
  const [openAction, setOpenAction] = useState<FileViewerAction | null>(null);
  // Registered file-viewer actions (e.g. aigentic's "Ask AI") that apply to the shown file. Only
  // present when the host wired an actionHost; each is gated by its own visibility + type check.
  const fileActions =
    entry && actionHost
      ? viewerActions().filter((a) => (!a.visible || a.visible(actionHost.user)) && (!a.applies || a.applies(entry)))
      : [];
  return (
    <>
    <Dialog.Root open={open && !!entry} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50 [backdrop-filter:var(--material-blur-thin)] data-[state=open]:animate-overlay-in data-[state=closed]:animate-overlay-out" />
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <Dialog.Content
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft' && onPrev) {
                e.preventDefault();
                onPrev();
              } else if (e.key === 'ArrowRight' && onNext) {
                e.preventDefault();
                onNext();
              }
            }}
            className={cn(
              'relative w-full max-w-4xl',
              'rounded-lg bg-surface-raised border border-separator shadow-elev-3 overflow-hidden focus:outline-none',
              'data-[state=open]:animate-pop-in data-[state=closed]:animate-pop-out',
            )}
          >
          <div className="flex items-center justify-between gap-4 px-4 h-12 border-b border-separator">
            <Dialog.Title className="text-subhead font-semibold text-text-primary truncate">{entry?.name}</Dialog.Title>
            <div className="flex items-center gap-1">
              {fileActions.map((a) => (
                // Ghost so it sits level with the header's ghost prev/next/download/close controls.
                <Button key={a.id} variant="ghost" size="sm" iconLeft={a.icon ? <a.icon className="h-4 w-4" /> : undefined} onClick={() => setOpenAction(a)}>
                  {a.label}
                </Button>
              ))}
              {fileActions.length > 0 && <span aria-hidden className="mx-1 h-5 w-px bg-separator" />}
              {navigable && (
                <>
                  <IconButton label={t('common.previous')} size="sm" disabled={!onPrev} onClick={() => onPrev?.()}>
                    <ChevronLeftIcon className="h-4 w-4" />
                  </IconButton>
                  <IconButton label={t('common.next')} size="sm" disabled={!onNext} onClick={() => onNext?.()}>
                    <ChevronRightIcon className="h-4 w-4" />
                  </IconButton>
                </>
              )}
              {entry && (
                <IconButton label={t('common.download')} size="sm" onClick={() => onDownload(entry)}>
                  <DownloadIcon className="h-4 w-4" />
                </IconButton>
              )}
              <Dialog.Close asChild>
                <IconButton label={t('common.close')} size="sm">
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
      {open && openAction && entry && actionHost && (
        // Nested Radix dialog stacked over the viewer; the file stays visible behind it. The action
        // owns its own UX + network calls — the viewer only hands it the file + the host's bridges.
        // Gated on `open` so it never lingers over a programmatically-closed preview.
        <Modal open onOpenChange={(o) => !o && setOpenAction(null)} title={openAction.label} size="xl">
          <openAction.Panel
            entry={entry}
            text={text}
            loadBytes={actionHost.loadBytes}
            apiFor={actionHost.apiFor}
            ui={actionHost.ui}
            user={actionHost.user}
            openService={actionHost.openService}
            close={() => setOpenAction(null)}
          />
        </Modal>
      )}
    </>
  );
}
