import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Avatar,
  Button,
  Field,
  Grid,
  Input,
  Modal,
  Stack,
  Text,
  TrashIcon,
  UploadIcon,
  toast,
  type HolisticUser,
} from '@holistic/ui';
import { ApiError, authApi } from '../api/holisticClient';

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function ProfileModal({
  open,
  onOpenChange,
  user,
  onUserChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: HolisticUser;
  onUserChange: (u: HolisticUser) => void;
}) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed from the identity we already hold, then refresh with the authoritative
  // values (notably the raw nickname, which the top-bar identity doesn't carry).
  useEffect(() => {
    if (!open) return;
    setError(null);
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setNickname('');
    setEmail(user.email ?? '');
    authApi
      .getProfile()
      .then((p) => {
        setFirstName(p.firstName ?? '');
        setLastName(p.lastName ?? '');
        setNickname(p.nickname ?? '');
        setEmail(p.email ?? '');
      })
      .catch(() => {});
  }, [open, user]);

  const emailInvalid = email.length > 0 && !EMAIL_RE.test(email);
  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  async function save() {
    if (emailInvalid) {
      setError('Please enter a valid email address.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onUserChange(await authApi.updateProfile({ firstName, lastName, email, nickname }));
      toast({ title: 'Profile updated', variant: 'success' });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update your profile.');
    } finally {
      setBusy(false);
    }
  }

  async function onPickAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!file) return;
    setAvatarBusy(true);
    setError(null);
    try {
      onUserChange(await authApi.uploadAvatar(file));
      toast({ title: 'Photo updated', variant: 'success' });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 415
          ? 'Use a PNG, JPEG, GIF or WebP image.'
          : err instanceof ApiError && err.status === 413
            ? 'That image is too large (max 5 MB).'
            : 'Could not upload the photo.',
      );
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    setError(null);
    try {
      onUserChange(await authApi.deleteAvatar());
    } catch {
      setError('Could not remove the photo.');
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Profile"
      description="Manage your name, email and photo."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save} loading={busy} disabled={emailInvalid}>
            Save
          </Button>
        </>
      }
    >
      <Stack gap={5}>
        <Stack direction="row" gap={4} align="center">
          <Avatar name={nickname || fullName || user.username} src={user.avatarUrl} size={64} />
          <Stack gap={2}>
            <Stack direction="row" gap={2} wrap>
              <Button size="sm" iconLeft={<UploadIcon className="h-4 w-4" />} loading={avatarBusy} onClick={() => fileRef.current?.click()}>
                Change photo
              </Button>
              {user.avatarUrl && (
                <Button size="sm" variant="ghost" iconLeft={<TrashIcon className="h-4 w-4" />} disabled={avatarBusy} onClick={removeAvatar}>
                  Remove
                </Button>
              )}
            </Stack>
            <Text variant="caption" color="tertiary">
              PNG, JPEG, GIF or WebP, up to 5 MB.
            </Text>
          </Stack>
        </Stack>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={onPickAvatar} />

        <Field label="Username" hint="Your login name — this can’t be changed">
          <Input value={user.username} readOnly disabled className="opacity-60" />
        </Field>
        <Grid cols={2} gap={3}>
          <Field label="First name">
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label="Last name">
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </Field>
        </Grid>
        <Field label="Nickname" hint="Shown across Holistic; defaults to your username">
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={user.username} autoComplete="nickname" />
        </Field>
        <Field label="Email" error={emailInvalid ? 'Enter a valid email address.' : undefined}>
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" invalid={emailInvalid} placeholder="you@example.com" />
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
