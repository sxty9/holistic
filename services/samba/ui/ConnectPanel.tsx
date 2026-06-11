import { useState } from 'react';
import { CodeBlock, Panel, SegmentedControl, Stack, Text, type HolisticUser } from '@holistic/ui';

type OS = 'windows' | 'macos' | 'linux';

function detectOS(): OS {
  const ua = navigator.userAgent;
  if (/Win/i.test(ua)) return 'windows';
  if (/Linux|X11/i.test(ua) && !/Android/i.test(ua)) return 'linux';
  return 'macos';
}

export function ConnectPanel({ user }: { user: HolisticUser }) {
  const [os, setOS] = useState<OS>(detectOS());
  const host = window.location.hostname || '<server-ip>';
  const u = user.username;

  const windows = `\\\\${host}\\${u}        (your private drive)\n\\\\${host}\\family   (the shared family drive)`;
  const macos = `smb://${host}/${u}\nsmb://${host}/family`;
  const linuxCifs = `sudo apt install cifs-utils\nsudo mkdir -p /mnt/holistic\nsudo mount -t cifs //${host}/${u} /mnt/holistic \\\n  -o user=${u},uid=$(id -u),gid=$(id -g),iocharset=utf8`;
  const linuxGio = `gio mount smb://${host}/${u}`;

  return (
    <Panel title="Connect from your computer">
      <Stack gap={4} className="p-4">
        <Text variant="footnote" color="secondary">
          Use your Holistic username and password. Your private drive is <Text as="span" weight="semibold">{u}</Text>; the shared drive is <Text as="span" weight="semibold">family</Text>.
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
            <Text variant="footnote" color="secondary">In File Explorer, type this into the address bar (or use “Map network drive”):</Text>
            <CodeBlock code={windows} />
          </Stack>
        )}
        {os === 'macos' && (
          <Stack gap={2}>
            <Text variant="footnote" color="secondary">In Finder, choose Go → Connect to Server (⌘K), then:</Text>
            <CodeBlock code={macos} />
          </Stack>
        )}
        {os === 'linux' && (
          <Stack gap={3}>
            <Stack gap={2}>
              <Text variant="footnote" color="secondary">Mount with cifs-utils:</Text>
              <CodeBlock code={linuxCifs} />
            </Stack>
            <Stack gap={2}>
              <Text variant="footnote" color="secondary">Or, in GNOME Files (no root):</Text>
              <CodeBlock code={linuxGio} />
            </Stack>
          </Stack>
        )}
      </Stack>
    </Panel>
  );
}
