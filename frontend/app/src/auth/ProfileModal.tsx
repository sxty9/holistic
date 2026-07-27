import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Avatar,
  Badge,
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
  useT,
  type SessionUser,
} from '@holisdk/ui';
import { ApiError, authApi, mailApi } from '../api/holisticClient';

export function ProfileModal({
  open,
  onOpenChange,
  user,
  onUserChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  user: SessionUser;
  onUserChange: (u: SessionUser) => void;
}) {
  const t = useT();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [nickname, setNickname] = useState('');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mail, setMail] = useState<{ primary: string; addresses: string[] } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Seed from the identity we already hold, then refresh with the authoritative
  // values (notably the raw nickname, which the top-bar identity doesn't carry).
  useEffect(() => {
    if (!open) return;
    setError(null);
    setFirstName(user.firstName ?? '');
    setLastName(user.lastName ?? '');
    setNickname('');
    setMail(null);
    authApi
      .getProfile()
      .then((p) => {
        setFirstName(p.firstName ?? '');
        setLastName(p.lastName ?? '');
        setNickname(p.nickname ?? '');
      })
      .catch(() => {});
    // The Holistic mailbox lives in the mail service; pull the primary ("Stamm") address and
    // every alias so they're visible here. Silently hidden if the user has no mail access.
    mailApi.identity().then(setMail).catch(() => {});
  }, [open, user]);

  const fullName = [firstName, lastName].filter(Boolean).join(' ');

  async function save() {
    setBusy(true);
    setError(null);
    try {
      onUserChange(await authApi.updateProfile({ firstName, lastName, nickname }));
      toast({ title: t('profile.updated'), variant: 'success' });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('profile.errUpdate'));
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
      toast({ title: t('profile.photoUpdated'), variant: 'success' });
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 415
          ? t('profile.errPhotoType')
          : err instanceof ApiError && err.status === 413
            ? t('profile.errPhotoSize')
            : t('profile.errPhotoUpload'),
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
      setError(t('profile.errPhotoRemove'));
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t('shell.profile')}
      description={t('profile.desc')}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={save} loading={busy}>
            {t('profile.save')}
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
                {t('profile.changePhoto')}
              </Button>
              {user.avatarUrl && (
                <Button size="sm" variant="ghost" iconLeft={<TrashIcon className="h-4 w-4" />} disabled={avatarBusy} onClick={removeAvatar}>
                  {t('profile.removePhoto')}
                </Button>
              )}
            </Stack>
            <Text variant="caption" color="tertiary">
              {t('profile.photoHint')}
            </Text>
          </Stack>
        </Stack>
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={onPickAvatar} />

        <Field label={t('auth.username')} hint={t('profile.usernameHint')}>
          <Input value={user.username} readOnly disabled className="opacity-60" />
        </Field>
        <Grid cols={2} gap={3}>
          <Field label={t('profile.firstName')}>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" />
          </Field>
          <Field label={t('profile.lastName')}>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" />
          </Field>
        </Grid>
        <Field label={t('profile.nickname')} hint={t('profile.nicknameHint')}>
          <Input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={user.username} autoComplete="nickname" />
        </Field>
        {mail && mail.addresses.length > 0 && (
          <Field label={t('profile.emailAddresses')} hint={t('profile.emailHint')}>
            <Stack gap={2}>
              {mail.addresses.map((addr) => (
                <Stack key={addr} direction="row" gap={2} align="center" justify="between">
                  <Text variant="body" className="break-all">
                    {addr}
                  </Text>
                  {addr === mail.primary && (
                    <Badge variant="accent" className="shrink-0">
                      {t('profile.primary')}
                    </Badge>
                  )}
                </Stack>
              ))}
            </Stack>
          </Field>
        )}
        {error && (
          <Text variant="footnote" color="danger">
            {error}
          </Text>
        )}
      </Stack>
    </Modal>
  );
}
