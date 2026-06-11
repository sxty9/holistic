import { useCallback, useEffect, useState } from 'react';
import {
  Breadcrumb,
  ContentRegion,
  FileBrowser,
  FilePreview,
  FileToolbar,
  MoveDialog,
  NewFolderDialog,
  Panel,
  RenameDialog,
  SegmentedControl,
  Stack,
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
  const [moving, setMoving] = useState<FileEntry[] | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

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
  const filtered = search ? entries.filter((e) => e.name.toLowerCase().includes(search.toLowerCase())) : entries;
  const selectedEntries = entries.filter((e) => selection.has(e.path));

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
      setSearch('');
      setCwd(entry.path);
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
    else if (action === 'move') setMoving(targets);
    else if (action === 'delete') void confirmDelete(targets);
    else if (action === 'info') {
      const t = targets[0];
      ui.toast({ title: t.name, description: `${t.kind === 'dir' ? 'Folder' : formatBytes(t.size)} · ${formatDate(t.mtime)}` });
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

  async function doMove(dstDir: string) {
    if (!moving) return;
    try {
      for (const m of moving) await api.post('fs/move', { src: m.path, dstDir });
      ui.toast({ title: 'Moved', variant: 'success' });
      reload();
    } catch (e) {
      ui.toast({ title: 'Move failed', description: (e as Error).message, variant: 'error' });
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
            <Breadcrumb
              segments={buildBreadcrumb(cwd, roots)}
              onNavigate={(p) => {
                setSearch('');
                setCwd(p);
              }}
            />
            <FileToolbar
              view={view}
              onViewChange={setView}
              search={search}
              onSearch={setSearch}
              selection={selectedEntries}
              canWrite={canWrite}
              onNewFolder={() => setNewFolderOpen(true)}
              onUpload={doUpload}
              onAction={handleAction}
            />
            <Panel>
              <FileBrowser
                entries={filtered}
                view={view}
                selection={selection}
                loading={loading}
                error={error}
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
      <MoveDialog open={!!moving} roots={roots} initialDir={cwd} onOpenChange={(o) => !o && setMoving(null)} onSubmit={doMove} />
    </ContentRegion>
  );
}
