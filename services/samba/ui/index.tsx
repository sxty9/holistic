import { FilesIcon, userHasRight, type HolisticUser, type ServicePlugin } from '@holistic/ui';
import { FileManager } from './FileManager';
import './i18n';

// The Files tab requires the "view" right (hp_samba_view, default-on). Without any Files
// right the tab is just empty overhead, so hide it. Admins always see it (userHasRight).
function canSeeFiles(user: HolisticUser): boolean {
  return userHasRight(user, 'hp_samba_view');
}

const plugin: ServicePlugin = {
  id: 'samba',
  displayName: 'Files',
  icon: FilesIcon,
  order: 10,
  visible: canSeeFiles,
  Component: FileManager,
};

export default plugin;
