import { useState, type FormEvent } from 'react';
import { AuthCard, AuthScene, Button, Field, HolisticMark, InlineLink, Input, PasswordInput, Stack, Text, type HolisticUser } from '@holistic/ui';
import { ApiError, authApi } from '../api/holisticClient';

export function LoginScreen({ onSuccess, onRegister }: { onSuccess: (u: HolisticUser) => void; onRegister: () => void }) {
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
      setError(err instanceof ApiError && err.status === 401 ? 'Wrong username or password.' : 'Could not sign in. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScene>
      <AuthCard logo={<HolisticMark />} title="Welcome to Holistic" subtitle="Sign in with your account">
        <form onSubmit={submit}>
          <Stack gap={4}>
            <Field label="Username">
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
            </Field>
            <Field label="Password">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            {error && (
              <Text variant="footnote" color="danger">
                {error}
              </Text>
            )}
            <Button variant="primary" size="lg" type="submit" loading={busy} disabled={!username || !password}>
              Sign In
            </Button>
            <Stack direction="row" gap={1} justify="center">
              <Text variant="footnote" color="secondary">
                No account?
              </Text>
              <InlineLink onClick={onRegister}>Create one</InlineLink>
            </Stack>
          </Stack>
        </form>
      </AuthCard>
    </AuthScene>
  );
}
