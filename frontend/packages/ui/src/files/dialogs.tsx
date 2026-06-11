import { useEffect, useState } from 'react';
import { Modal } from '../overlay/modal';
import { Button, Field, Input } from '../controls';
import { Stack, Text } from '../primitives';
import type { FileRoot } from '../plugin/contract';

function PromptModal({
  open,
  title,
  label,
  initial,
  submitLabel,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  title: string;
  label: string;
  initial?: string;
  submitLabel: string;
  onOpenChange: (o: boolean) => void;
  onSubmit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial ?? '');
  useEffect(() => {
    if (open) setValue(initial ?? '');
  }, [open, initial]);
  const submit = () => {
    const v = value.trim();
    if (v) {
      onSubmit(v);
      onOpenChange(false);
    }
  };
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!value.trim()}>
            {submitLabel}
          </Button>
        </>
      }
    >
      <Field label={label}>
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
          }}
        />
      </Field>
    </Modal>
  );
}

export function NewFolderDialog({ open, onOpenChange, onSubmit }: { open: boolean; onOpenChange: (o: boolean) => void; onSubmit: (name: string) => void }) {
  return <PromptModal open={open} onOpenChange={onOpenChange} onSubmit={onSubmit} title="New Folder" label="Folder name" submitLabel="Create" />;
}

export function RenameDialog({ open, initialName, onOpenChange, onSubmit }: { open: boolean; initialName: string; onOpenChange: (o: boolean) => void; onSubmit: (name: string) => void }) {
  return <PromptModal open={open} onOpenChange={onOpenChange} onSubmit={onSubmit} title="Rename" label="New name" initial={initialName} submitLabel="Rename" />;
}

/** Minimal destination picker: quick root chips + an editable virtual path. */
export function MoveDialog({
  open,
  roots,
  initialDir,
  onOpenChange,
  onSubmit,
}: {
  open: boolean;
  roots: FileRoot[];
  initialDir?: string;
  onOpenChange: (o: boolean) => void;
  onSubmit: (dstDir: string) => void;
}) {
  const [dest, setDest] = useState(initialDir ?? roots[0]?.key ?? 'me');
  useEffect(() => {
    if (open) setDest(initialDir ?? roots[0]?.key ?? 'me');
  }, [open, initialDir, roots]);
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Move to…"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const v = dest.trim();
              if (v) {
                onSubmit(v);
                onOpenChange(false);
              }
            }}
          >
            Move
          </Button>
        </>
      }
    >
      <Stack gap={3}>
        <Stack direction="row" gap={2} wrap>
          {roots.map((r) => (
            <Button key={r.key} variant={dest === r.key || dest.startsWith(r.key + '/') ? 'primary' : 'secondary'} size="sm" onClick={() => setDest(r.key)}>
              {r.label}
            </Button>
          ))}
        </Stack>
        <Field label="Destination folder" hint="e.g. family/Movies — the folder must already exist">
          <Input value={dest} onChange={(e) => setDest(e.target.value)} />
        </Field>
        <Text variant="caption" color="tertiary">
          Files keep their name; a folder with the same name must not already exist there.
        </Text>
      </Stack>
    </Modal>
  );
}
