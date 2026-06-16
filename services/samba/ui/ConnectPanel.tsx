import { useState } from 'react';
import { CodeBlock, Panel, SegmentedControl, Stack, Text, useT, type HolisticUser } from '@holistic/ui';

type OS = 'windows' | 'macos' | 'linux';

function detectOS(): OS {
  const ua = navigator.userAgent;
  if (/Win/i.test(ua)) return 'windows';
  if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return 'linux';
  return 'macos';
}

export function ConnectPanel({ user }: { user: HolisticUser }) {
  const t = useT();
  const [os, setOS] = useState<OS>(detectOS());
  const host = window.location.hostname || '<server-ip>';
  const u = user.username;

  const windows = `\\\\${host}\\${u}        ${t('samba.winPrivateNote')}\n\\\\${host}\\family   ${t('samba.winSharedNote')}`;
  const macos = `smb://${host}/${u}\nsmb://${host}/family`;
  const linuxCifs = `sudo apt install cifs-utils\nsudo mkdir -p /mnt/holistic\nsudo mount -t cifs //${host}/${u} /mnt/holistic \\\n  -o user=${u},uid=$(id -u),gid=$(id -g),iocharset=utf8`;
  const linuxGio = `gio mount smb://${host}/${u}`;

  return (
    <Panel title={t('samba.connectTitle')}>
      <Stack gap={4} className="p-4">
        <Text variant="footnote" color="secondary">
          {t('samba.connectIntro', { user: u })}
        </Text>
        <SegmentedControl
          value={os}
          onChange={setOS}
          options={[
            { value: 'windows', label: 'Windows' },
            { value: 'macos', label: 'macOS' },
            { value: 'linux', label: 'Linux' },
          ]}
        />
        {os === 'windows' && (
          <Stack gap={2}>
            <Text variant="footnote" color="secondary">{t('samba.winHint')}</Text>
            <CodeBlock code={windows} />
          </Stack>
        )}
        {os === 'macos' && (
          <Stack gap={2}>
            <Text variant="footnote" color="secondary">{t('samba.macHint')}</Text>
            <CodeBlock code={macos} />
          </Stack>
        )}
        {os === 'linux' && (
          <Stack gap={3}>
            <Stack gap={2}>
              <Text variant="footnote" color="secondary">{t('samba.linuxCifsHint')}</Text>
              <CodeBlock code={linuxCifs} />
            </Stack>
            <Stack gap={2}>
              <Text variant="footnote" color="secondary">{t('samba.linuxGioHint')}</Text>
              <CodeBlock code={linuxGio} />
            </Stack>
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}
