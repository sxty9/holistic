import { useState, type FormEvent } from 'react';
import { AuthCard, AuthScene, Button, Field, HolisticMark, InlineLink, Input, PasswordInput, Stack, Text, useT, type HolisticUser } from '@holistic/ui';
import { ApiError, authApi } from '../api/holisticClient';

export function LoginScreen({ onSuccess, onRegister }: { onSuccess: (u: HolisticUser) => void; onRegister: () => void }) {
  const t = useT();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <AuthScene>
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
    </AuthScene>
  );
}
