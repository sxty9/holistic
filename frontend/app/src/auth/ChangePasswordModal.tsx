import { useEffect, useState } from 'react';
import { Button, Field, Modal, PasswordInput, Stack, Text, toast } from '@holistic/ui';
import { ApiError, authApi } from '../api/holisticClient';

export function ChangePasswordModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setCurrent('');
      setNext('');
      setConfirm('');
      setError(null);
    }
  }, [open]);

  async function submit() {
    if (next !== confirm) {
      setError('New passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authApi.changePassword(current, next);
      toast({ title: 'Password updated', description: 'Your Linux and Samba passwords are in sync.', variant: 'success' });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? 'Your current password is wrong.' : 'Could not update the password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Change password"
      description="Updates both your login and file-sharing password."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!current || !next || !confirm}>
            Update
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        <Field label="Current password">
          <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label="New password">
          <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Confirm new password">
          <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
        </Field>
        {error && (
          <Text variant="footnote" color="danger">
            {error}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
