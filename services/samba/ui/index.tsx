import { FilesIcon, type ServicePlugin } from '@holistic/ui';
import { FileManager } from './FileManager';
import './i18n';

const plugin: ServicePlugin = {
  id: 'samba',
  displayName: 'Files',
  icon: FilesIcon,
  order: 10,
  Component: FileManager,
};

export default plugin;
