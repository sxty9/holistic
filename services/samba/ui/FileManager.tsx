import { useCallback, useEffect, useState } from 'react';
import {
  Breadcrumb,
  Button,
  ContentRegion,
  CopyIcon,
  FileBrowser,
  FilePreview,
  FileToolbar,
  MoveIcon,
  NewFolderDialog,
  Panel,
  RenameDialog,
  SegmentedControl,
  Stack,
  Text,
  UploadControl,
  formatBytes,
  formatDate,
  type BreadcrumbSegment,
  type FileActionId,
  type FileEntry,
  type FileRoot,
  type ServiceContextProps,
  type TextPayload,
} from '@holistic/ui';
import { ConnectPanel } from './ConnectPanel';

interface Clipboard {
  mode: 'move' | 'copy';
  items: FileEntry[];
}

function buildBreadcrumb(cwd: string, roots: FileRoot[]): BreadcrumbSegment[] {
  const [rootKey, ...rest] = cwd.split('/');
  const root = roots.find((r) => r.key === rootKey);
  const segs: BreadcrumbSegment[] = [{ label: root?.label ?? rootKey, path: rootKey }];
  let acc = rootKey;
  for (const part of rest) {
    if (!part) continue;
    acc += '/' + part;
    segs.push({ label: part, path: acc });
  }
  return segs;
}

const q = (path: string) => encodeURIComponent(path);
const parentOf = (path: string) => path.split('/').slice(0, -1).join('/');

export function FileManager({ user, api, ui }: ServiceContextProps) {
  const [tab, setTab] = useState<'files' | 'connect'>('files');
  const [roots, setRoots] = useState<FileRoot[]>([]);
  const [cwd, setCwd] = useState('me');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<{ entry: FileEntry; rawUrl?: string; text?: TextPayload | null } | null>(null);
  const [renaming, setRenaming] = useState<FileEntry | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [clipboard, setClipboard] = useState<Clipboard | null>(null);

  useEffect(() => {
    api
      .get<FileRoot[]>('fs/roots')
      .then((rs) => {
        setRoots(rs);
        if (rs[0]) setCwd(rs[0].key);
      })
      .catch(() => undefined);
  }, [api]);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    setSelection(new Set());
    api
      .get<{ path: string; entries: FileEntry[] }>(`fs/list?path=${q(cwd)}`)
      .then((r) => setEntries(r.entries))
      .catch((e: Error) => setError(e.message || 'Could not load this folder.'))
      .finally(() => setLoading(false));
  }, [api, cwd]);

  useEffect(() => reload(), [reload]);

  const currentRoot = roots.find((r) => cwd === r.key || cwd.startsWith(r.key + '/'));
  const canWrite = currentRoot?.writable ?? true;
  const canGoUp = cwd.includes('/'); // false at a share root — nothing above it
  const filtered = search ? entries.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())) : entries;
  const selectedEntries = entries.filter((e) => selection.has(e.path));
  const cutPaths = clipboard?.mode === 'move' ? new Set(clipboard.items.map((i) => i.path)) : undefined;

  function navigate(path: string) {
    setSearch('');
    setCwd(path);
  }

  function download(items: FileEntry[]) {
    for (const it of items) {
      const a = document.createElement('a');
      a.href = api.url(`fs/download?path=${q(it.path)}`);
      a.download = it.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  }

  async function openEntry(entry: FileEntry) {
    if (entry.kind === 'dir') {
      navigate(entry.path);
      return;
    }
    if (entry.viewer === 'text' || entry.viewer === 'markdown') {
      try {
        const t = await api.get<TextPayload>(`fs/text?path=${q(entry.path)}`);
        setPreview({ entry, text: t });
      } catch {
        setPreview({ entry, text: null });
      }
    } else if (entry.viewer) {
      setPreview({ entry, rawUrl: api.url(`fs/raw?path=${q(entry.path)}`) });
    } else {
      download([entry]);
    }
  }

  async function confirmDelete(targets: FileEntry[]) {
    const label = targets.length > 1 ? `${targets.length} items` : `“${targets[0].name}”`;
    const ok = await ui.confirm({ title: `Delete ${label}?`, description: 'This can’t be undone.', danger: true, confirmLabel: 'Delete' });
    if (!ok) return;
    try {
      for (const t of targets) await api.post('fs/delete', { path: t.path, recursive: t.kind === 'dir' });
      ui.toast({ title: 'Deleted', variant: 'success' });
      reload();
    } catch (e) {
      ui.toast({ title: 'Delete failed', description: (e as Error).message, variant: 'error' });
    }
  }

  function handleAction(action: FileActionId, targets: FileEntry[]) {
    if (action === 'download') download(targets.filter((t) => t.kind === 'file'));
    else if (action === 'rename') setRenaming(targets[0]);
    else if (action === 'move') {
      setClipboard({ mode: 'move', items: targets });
      setSelection(new Set());
    } else if (action === 'copy') {
      setClipboard({ mode: 'copy', items: targets });
      setSelection(new Set());
    } else if (action === 'delete') void confirmDelete(targets);
    else if (action === 'info') {
      const t = targets[0];
      ui.toast({ title: t.name, description: `${t.kind === 'dir' ? 'Folder' : formatBytes(t.size)} · ${formatDate(t.mtime)}` });
    }
  }

  async function paste() {
    if (!clipboard) return;
    const op = clipboard.mode === 'move' ? 'fs/move' : 'fs/copy';
    let done = 0;
    try {
      for (const it of clipboard.items) {
        if (clipboard.mode === 'move' && parentOf(it.path) === cwd) continue; // already here
        await api.post(op, { src: it.path, dstDir: cwd });
        done += 1;
      }
      ui.toast({ title: clipboard.mode === 'move' ? 'Moved' : 'Copied', description: `${done || clipboard.items.length} item${(done || clipboard.items.length) > 1 ? 's' : ''}`, variant: 'success' });
      setClipboard(null);
      reload();
    } catch (e) {
      ui.toast({ title: clipboard.mode === 'move' ? 'Move failed' : 'Copy failed', description: (e as Error).message, variant: 'error' });
    }
  }

  async function doRename(name: string) {
    if (!renaming) return;
    try {
      await api.post('fs/rename', { path: renaming.path, newName: name });
      ui.toast({ title: 'Renamed', variant: 'success' });
      reload();
    } catch (e) {
      ui.toast({ title: 'Rename failed', description: (e as Error).message, variant: 'error' });
    }
  }

  async function doMkdir(name: string) {
    try {
      await api.post('fs/mkdir', { path: cwd, name });
      ui.toast({ title: 'Folder created', variant: 'success' });
      reload();
    } catch (e) {
      ui.toast({ title: 'Could not create folder', description: (e as Error).message, variant: 'error' });
    }
  }

  async function doUpload(files: File[]) {
    try {
      for (const f of files) {
        const fd = new FormData();
        fd.append('path', cwd);
        fd.append('file', f);
        const res = await api.raw('fs/upload', { method: 'POST', body: fd });
        if (!res.ok) throw new Error(`Upload of ${f.name} failed`);
      }
      ui.toast({ title: `Uploaded ${files.length} file${files.length > 1 ? 's' : ''}`, variant: 'success' });
      reload();
    } catch (e) {
      ui.toast({ title: 'Upload failed', description: (e as Error).message, variant: 'error' });
    }
  }

  const clipboardSummary = clipboard
    ? clipboard.items.length === 1
      ? clipboard.items[0].name
      : `${clipboard.items.length} items`
    : '';

  return (
    <ContentRegion>
      <Stack gap={4}>
        <SegmentedControl
          value={tab}
          onChange={setTab}
          options={[
            { value: 'files', label: 'Files' },
            { value: 'connect', label: 'Connect' },
          ]}
        />

        {tab === 'files' ? (
          <Stack gap={3}>
            <Breadcrumb segments={buildBreadcrumb(cwd, roots)} onNavigate={navigate} />
            <FileToolbar
              view={view}
              onViewChange={setView}
              search={search}
              onSearch={setSearch}
              selection={selectedEntries}
              canWrite={canWrite}
              canGoUp={canGoUp}
              onNavigateUp={() => navigate(parentOf(cwd))}
              onNewFolder={() => setNewFolderOpen(true)}
              onUpload={doUpload}
              onAction={handleAction}
            />

            {clipboard && (
              <Stack
                direction="row"
                align="center"
                justify="between"
                gap={3}
                className="rounded-md border border-accent/40 bg-accent/10 px-3 py-2"
              >
                <Text variant="footnote" color="secondary">
                  {clipboard.mode === 'move' ? 'Moving' : 'Copying'} <Text as="span" weight="semibold" color="primary">{clipboardSummary}</Text> — go to a folder, then paste.
                </Text>
                <Stack direction="row" gap={2}>
                  <Button variant="ghost" size="sm" onClick={() => setClipboard(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    iconLeft={clipboard.mode === 'move' ? <MoveIcon className="h-4 w-4" /> : <CopyIcon className="h-4 w-4" />}
                    onClick={paste}
                  >
                    {clipboard.mode === 'move' ? 'Move here' : 'Copy here'}
                  </Button>
                </Stack>
              </Stack>
            )}

            <Panel>
              <FileBrowser
                entries={filtered}
                view={view}
                selection={selection}
                loading={loading}
                error={error}
                cutPaths={cutPaths}
                onOpen={openEntry}
                onSelectionChange={setSelection}
                onAction={handleAction}
                emptyAction={canWrite ? <UploadControl onFiles={doUpload} /> : undefined}
              />
            </Panel>
          </Stack>
        ) : (
          <ConnectPanel user={user} />
        )}
      </Stack>

      <FilePreview
        open={!!preview}
        entry={preview?.entry ?? null}
        rawUrl={preview?.rawUrl}
        text={preview?.text}
        onOpenChange={(o) => !o && setPreview(null)}
        onDownload={(e) => download([e])}
      />
      <NewFolderDialog open={newFolderOpen} onOpenChange={setNewFolderOpen} onSubmit={doMkdir} />
      <RenameDialog open={!!renaming} initialName={renaming?.name ?? ''} onOpenChange={(o) => !o && setRenaming(null)} onSubmit={doRename} />
    </ContentRegion>
  );
}
