import { useEffect, useState, type FormEvent } from 'react';
import { AuthCard, AuthScene, Button, Field, HolisticMark, InlineLink, Input, Modal, PasswordInput, Stack, Text, useT, type HolisticUser } from '@holistic/ui';
import { ApiError, authApi, scopedApi } from '../api/holisticClient';

export function LoginScreen({ onSuccess, onRegister }: { onSuccess: (u: HolisticUser) => void; onRegister: () => void }) {
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Emergency shutdown ("Not-Aus"): a pre-login button that lets someone without an
  // account cleanly power the server off (e.g. an approaching storm while the admin is
  // away). It is served, gated and rate-limited by the hostek service; we only show it
  // when an admin has armed it, and the entered password is the sole gate.
  const [notausArmed, setNotausArmed] = useState(false);
  const [notausOpen, setNotausOpen] = useState(false);
  const [notausPw, setNotausPw] = useState('');
  const [notausBusy, setNotausBusy] = useState(false);
  const [notausError, setNotausError] = useState<string | null>(null);
  const [shuttingDown, setShuttingDown] = useState(false);

  useEffect(() => {
    let active = true;
    scopedApi('hostek')
      .get<{ armed: boolean }>('shutdown')
      .then((r) => {
        if (active) setNotausArmed(r.armed);
      })
      .catch(() => {
        /* hostek unavailable or feature not installed — no button */
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      onSuccess(await authApi.login(username, password));
    } catch (err) {
      setError(err instanceof ApiError && err.status === 401 ? t('auth.errWrongCreds') : t('auth.errSignIn'));
    } finally {
      setBusy(false);
    }
  }

  function openNotaus() {
    setNotausPw('');
    setNotausError(null);
    setNotausOpen(true);
  }

  async function triggerNotaus() {
    setNotausBusy(true);
    setNotausError(null);
    try {
      await scopedApi('hostek').post('shutdown', { password: notausPw });
      setNotausOpen(false);
      setShuttingDown(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setNotausError(t('notaus.errWrongPw'));
      else if (err instanceof ApiError && err.status === 429) setNotausError(t('notaus.errLocked'));
      else setNotausError(t('notaus.errFailed'));
    } finally {
      setNotausBusy(false);
    }
  }

  return (
    <AuthScene>
      <Stack gap={4}>
        {shuttingDown ? (
          <AuthCard logo={<HolisticMark />} title={t('notaus.doneTitle')} subtitle={t('notaus.doneSubtitle')}>
            <Text variant="footnote" color="secondary" className="block text-center">
              {t('notaus.doneBody')}
            </Text>
          </AuthCard>
        ) : (
          <AuthCard logo={<HolisticMark />} title={t('auth.loginTitle')} subtitle={t('auth.loginSubtitle')}>
            <form onSubmit={submit}>
              <Stack gap={4}>
                <Field label={t('auth.username')}>
                  <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
                </Field>
                <Field label={t('auth.password')}>
                  <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </Field>
                {error && (
                  <Text variant="footnote" color="danger">
                    {error}
                  </Text>
                )}
                <Button variant="primary" size="lg" type="submit" loading={busy} disabled={!username || !password}>
                  {t('auth.signIn')}
                </Button>
                <Stack direction="row" gap={1} justify="center">
                  <Text variant="footnote" color="secondary">
                    {t('auth.noAccount')}
                  </Text>
                  <InlineLink onClick={onRegister}>{t('auth.createOne')}</InlineLink>
                </Stack>
              </Stack>
            </form>
          </AuthCard>
        )}
        {notausArmed && !shuttingDown && (
          <Stack direction="row" justify="center">
            <Button variant="destructive" size="sm" onClick={openNotaus}>
              {t('notaus.button')}
            </Button>
          </Stack>
        )}
      </Stack>

      <Modal
        open={notausOpen}
        onOpenChange={setNotausOpen}
        title={t('notaus.modalTitle')}
        description={t('notaus.modalDesc')}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setNotausOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button variant="destructive" onClick={triggerNotaus} loading={notausBusy} disabled={!notausPw}>
              {t('notaus.confirm')}
            </Button>
          </>
        }
      >
        <Stack gap={4}>
          <Field label={t('notaus.passwordLabel')}>
            <PasswordInput value={notausPw} onChange={(e) => setNotausPw(e.target.value)} autoComplete="off" autoFocus />
          </Field>
          {notausError && (
            <Text variant="footnote" color="danger">
              {notausError}
            </Text>
          )}
        </Stack>
      </Modal>
    </AuthScene>
  );
}
