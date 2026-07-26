// Messages for the Consumption service. English (US) is the canonical source; the other Holistic
// locales are filled in by the nightly translation run (missing keys fall back to en-US).
//
// Only this tab's own chrome + the shared metric-kind labels are translated here. A service's own
// metric labels come from its usage.d manifest; a service may localize them by registering
// `usage.metric.<service>.<id>` in its own bundle — otherwise the manifest text shows verbatim
// (the same fallback rule the Rights and Configuration catalogs use).
import { registerMessages } from '@holistic/ui';

registerMessages({
  'en-US': {
    'service.usage': 'Consumption',
    'usage.loadFailed': 'Could not load consumption data.',
    'usage.empty': 'No service reports any consumption.',
    'usage.kind.storage': 'Storage',
    'usage.kind.memory': 'Memory',
    'usage.kind.compute': 'Compute',
    'usage.kind.tokens': 'AI tokens',
    // The in-repo services' own metric labels (dashboard + samba).
    'usage.metric.dashboard.cpuSeconds': 'CPU time',
    'usage.metric.dashboard.memoryBytes': 'Memory',
    'usage.metric.samba.storageBytes': 'Stored data',
  },
});
