import { SettingsIcon, type SessionUser, type ServicePlugin } from '@holisdk/ui';
import { Config } from './Config';
import './i18n';

// Configuration is the admin counterpart of the Permissions tab: one central place for every
// service's settings (the rights standard's mirror, for values instead of groups). Nothing here
// concerns a normal user, so the tab is admin-only — it does not follow the hp_<id>_* rights
// convention and therefore supplies its own `visible` gate.
const plugin: ServicePlugin = {
  id: 'config',
  displayName: 'Configuration',
  icon: SettingsIcon,
  order: 90,
  visible: (user: SessionUser) => user.isAdmin,
  Component: Config,
};

export default plugin;
