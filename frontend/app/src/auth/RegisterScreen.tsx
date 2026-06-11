import { useState, type FormEvent } from 'react';
import { AuthCard, AuthScene, Button, Field, HolisticMark, InlineLink, Input, PasswordInput, Stack, Text, type HolisticUser } from '@holistic/ui';
import { ApiError, authApi } from '../api/holisticClient';

const USERNAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;

export function RegisterScreen({ onSuccess, onLogin }: { onSuccess: (u: HolisticUser) => void; onLogin: () => void }) {
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
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSuccess(
        await authApi.register({ username, password, display_name: displayName || username, invite_code: invite.trim() }),
      );
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) setError('That invite code is invalid or already used.');
      else if (err instanceof ApiError && err.status === 409) setError('That username is taken.');
      else setError('Could not create the account.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthScene>
      <AuthCard logo={<HolisticMark />} title="Create your account" subtitle="You’ll get a private drive and family access">
        <form onSubmit={submit}>
          <Stack gap={4}>
            <Field label="Invite code" hint="Ask a family admin for this">
              <Input value={invite} onChange={(e) => setInvite(e.target.value)} placeholder="xxxxxxxx-xxxxxxxx" autoComplete="off" />
            </Field>
            <Field label="Username" hint="Lowercase letters, digits, - and _ — becomes your login" error={usernameInvalid ? 'Invalid username.' : undefined}>
              <Input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} autoComplete="username" invalid={usernameInvalid} />
            </Field>
            <Field label="Display name">
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Grandma" />
            </Field>
            <Field label="Password">
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </Field>
            <Field label="Confirm password">
              <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </Field>
            {error && (
              <Text variant="footnote" color="danger">
                {error}
              </Text>
            )}
            <Button variant="primary" size="lg" type="submit" loading={busy} disabled={!invite || !username || !password || usernameInvalid}>
              Create Account
            </Button>
            <Stack direction="row" gap={1} justify="center">
              <Text variant="footnote" color="secondary">
                Already have an account?
              </Text>
              <InlineLink onClick={onLogin}>Sign in</InlineLink>
            </Stack>
          </Stack>
        </form>
      </AuthCard>
    </AuthScene>
  );
}
