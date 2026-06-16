import { useState, type FormEvent } from 'react';
import { AuthCard, AuthScene, Button, Field, HolisticMark, InlineLink, Input, PasswordInput, Stack, Text, useT, type HolisticUser } from '@holistic/ui';
import { ApiError, authApi } from '../api/holisticClient';

const USERNAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;

export function RegisterScreen({ onSuccess, onLogin }: { onSuccess: (u: HolisticUser) => void; onLogin: () => void }) {
  const t = useT();
  const [invite, setInvite] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameInvalid = username.length > 0 && !USERNAME_RE.test(username);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t('auth.errPwMismatch'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSuccess(
        await authApi.register({ username, password, display_name: displayName || username, invite_code: invite.trim() }),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError(t('auth.errInvite'));
      else if (err instanceof ApiError && err.status === 409) setError(t('auth.errTaken'));
      else setError(t('auth.errCreate'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScene>
      <AuthCard logo={<HolisticMark />} title={t('auth.registerTitle')} subtitle={t('auth.registerSubtitle')}>
        <form onSubmit={submit}>
          <Stack gap={4}>
            <Field label={t('auth.inviteCode')} hint={t('auth.inviteHint')}>
              <Input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="xxxxxxxx-xxxxxxxx" autoComplete="off" />
            </Field>
            <Field label={t('auth.username')} hint={t('auth.usernameHint')} error={usernameInvalid ? t('auth.errInvalidUsername') : undefined}>
              <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="username" invalid={usernameInvalid} />
            </Field>
            <Field label={t('auth.displayName')}>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t('auth.displayNamePlaceholder')} />
            </Field>
            <Field label={t('auth.password')}>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label={t('auth.confirmPassword')}>
              <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </Field>
            {error && (
              <Text variant="footnote" color="danger">
                {error}
              </Text>
            )}
            <Button variant="primary" size="lg" type="submit" loading={busy} disabled={!invite || !username || !password || usernameInvalid}>
              {t('auth.createAccount')}
            </Button>
            <Stack direction="row" gap={1} justify="center">
              <Text variant="footnote" color="secondary">
                {t('auth.haveAccount')}
              </Text>
              <InlineLink onClick={onLogin}>{t('auth.signInShort')}</InlineLink>
            </Stack>
          </Stack>
        </form>
      </AuthCard>
    </AuthScene>
  );
}
