import { useEffect, useState } from 'react';
import { Button, Field, Modal, PasswordInput, Stack, Text, toast, useT } from '@holistic/ui';
import { ApiError, authApi } from '../api/holisticClient';

export function ChangePasswordModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const t = useT();
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
      setError(t('auth.errNewPwMismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await authApi.changePassword(current, next);
      toast({ title: t('auth.pwUpdatedTitle'), description: t('auth.pwUpdatedDesc'), variant: 'success' });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t('auth.errCurrentPw') : t('auth.errUpdatePw'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('shell.changePassword')}
      description={t('auth.pwModalDesc')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} loading={busy} disabled={!current || !next || !confirm}>
            {t('common.update')}
          </Button>
        </>
      }
    >
      <Stack gap={4}>
        <Field label={t('auth.currentPassword')}>
          <PasswordInput value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
        </Field>
        <Field label={t('auth.newPassword')}>
          <PasswordInput value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label={t('auth.confirmNewPassword')}>
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
