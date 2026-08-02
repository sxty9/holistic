import { GaugeIcon, type HolisticUser, type ServicePlugin } from '@holistic/ui';
import { Usage } from './Usage';
import './i18n';

// Consumption is the third central admin surface, alongside Rights (privleg) and Configuration:
// one place to see every service's resource use — AI tokens, compute and storage — so load and
// capacity are judged across the whole landscape. Nothing here concerns a normal user, so the tab
// is admin-only and supplies its own `visible` gate (it does not follow the hp_<id>_* convention).
const plugin: ServicePlugin = {
  id: 'usage',
  displayName: 'Consumption',
  icon: GaugeIcon,
  order: 91,
  visible: (user: HolisticUser) => user.isAdmin,
  Component: Usage,
};

export default plugin;
