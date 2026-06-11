import { Button, SearchField, SegmentedControl } from '../controls';
import { DownloadIcon, FolderPlusIcon, GridIcon, ListIcon, MoveIcon, PencilIcon, TrashIcon } from '../icons';
import { Text } from '../primitives';
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
  onNewFolder: () => void;
  onUpload: (files: File[]) => void;
  onAction: (action: FileActionId, entries: FileEntry[]) => void;
}

export function FileToolbar({ view, onViewChange, search, onSearch, selection, canWrite, onNewFolder, onUpload, onAction }: FileToolbarProps) {
  const hasSel = selection.length > 0;
  const onlyFiles = hasSel && selection.every((s) => s.kind === 'file');
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-2">
        {hasSel ? (
          <>
            <Text variant="footnote" color="secondary">
              {selection.length} selected
            </Text>
            {onlyFiles && (
              <Button variant="secondary" size="sm" iconLeft={<DownloadIcon className="h-4 w-4" />} onClick={() => onAction('download', selection)}>
                Download
              </Button>
            )}
            {selection.length === 1 && (
              <Button variant="secondary" size="sm" iconLeft={<PencilIcon className="h-4 w-4" />} onClick={() => onAction('rename', selection)}>
                Rename
              </Button>
            )}
            <Button variant="secondary" size="sm" iconLeft={<MoveIcon className="h-4 w-4" />} onClick={() => onAction('move', selection)}>
              Move
            </Button>
            <Button variant="destructive" size="sm" iconLeft={<TrashIcon className="h-4 w-4" />} onClick={() => onAction('delete', selection)}>
              Delete
            </Button>
          </>
        ) : (
          canWrite && (
            <>
              <Button variant="secondary" size="sm" iconLeft={<FolderPlusIcon className="h-4 w-4" />} onClick={onNewFolder}>
                New Folder
              </Button>
              <UploadControl onFiles={onUpload} />
            </>
          )
        )}
      </div>
      <div className="flex items-center gap-2">
        <SearchField value={search} onChange={onSearch} placeholder="Search this folder" className="w-48" />
        <SegmentedControl
          value={view}
          onChange={onViewChange}
          options={[
            { value: 'grid', icon: <GridIcon className="h-4 w-4" /> },
            { value: 'list', icon: <ListIcon className="h-4 w-4" /> },
          ]}
        />
      </div>
    </div>
  );
}
