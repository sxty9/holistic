import { Button, IconButton, SearchField, SegmentedControl } from '../controls';
import { ArrowUpIcon, CopyIcon, DownloadIcon, FolderPlusIcon, GridIcon, ListIcon, MoveIcon, PencilIcon, TrashIcon } from '../icons';
import { Text } from '../primitives';
import { useT } from '../i18n';
import type { FileEntry } from '../plugin/contract';
import { UploadControl } from './parts';
import type { FileActionId } from './FileBrowser';

export interface FileToolbarProps {
  view: 'grid' | 'list';
  onViewChange: (v: 'grid' | 'list') => void;
  search: string;
  onSearch: (s: string) => void;
  selection: FileEntry[];
  canWrite: boolean;
  /** Whether the current folder has a parent within this share (false at a root). */
  canGoUp: boolean;
  onNavigateUp: () => void;
  onNewFolder: () => void;
  onUpload: (files: File[]) => void;
  onAction: (action: FileActionId, entries: FileEntry[]) => void;
}

export function FileToolbar({ view, onViewChange, search, onSearch, selection, canWrite, canGoUp, onNavigateUp, onNewFolder, onUpload, onAction }: FileToolbarProps) {
  const t = useT();
  const hasSel = selection.length > 0;
  const onlyFiles = hasSel && selection.every((s) => s.kind === 'file');
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2 flex-wrap">
        <IconButton
          label={t('files.parentFolder')}
          variant="secondary"
          size="sm"
          onClick={onNavigateUp}
          disabled={!canGoUp}
        >
          <ArrowUpIcon className="h-4 w-4" />
        </IconButton>
        {canWrite && (
          <>
            <Button variant="secondary" size="sm" iconLeft={<FolderPlusIcon className="h-4 w-4" />} onClick={onNewFolder}>
              {t('files.newFolder')}
            </Button>
            <UploadControl onFiles={onUpload} />
          </>
        )}
        {hasSel && (
          <>
            {canWrite && <span aria-hidden className="mx-1 h-5 w-px bg-separator" />}
            <Text variant="footnote" color="secondary">
              {t('files.selected', { count: selection.length })}
            </Text>
            {onlyFiles && (
              <Button variant="secondary" size="sm" iconLeft={<DownloadIcon className="h-4 w-4" />} onClick={() => onAction('download', selection)}>
                {t('common.download')}
              </Button>
            )}
            {selection.length === 1 && (
              <Button variant="secondary" size="sm" iconLeft={<PencilIcon className="h-4 w-4" />} onClick={() => onAction('rename', selection)}>
                {t('common.rename')}
              </Button>
            )}
            <Button variant="secondary" size="sm" iconLeft={<CopyIcon className="h-4 w-4" />} onClick={() => onAction('copy', selection)}>
              {t('common.copy')}
            </Button>
            <Button variant="secondary" size="sm" iconLeft={<MoveIcon className="h-4 w-4" />} onClick={() => onAction('move', selection)}>
              {t('common.move')}
            </Button>
            <Button variant="destructive" size="sm" iconLeft={<TrashIcon className="h-4 w-4" />} onClick={() => onAction('delete', selection)}>
              {t('common.delete')}
            </Button>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <SearchField value={search} onChange={onSearch} placeholder={t('files.searchFolder')} className="w-48" />
        <SegmentedControl
          value={view}
          onChange={onViewChange}
          options={[
            { value: 'grid', icon: <GridIcon className="h-4 w-4" />, 'aria-label': t('files.gridView') },
            { value: 'list', icon: <ListIcon className="h-4 w-4" />, 'aria-label': t('files.listView') },
          ]}
        />
      </div>
    </div>
  );
}
