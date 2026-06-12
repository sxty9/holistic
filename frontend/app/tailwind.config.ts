import preset from '@holistic/ui/tailwind-preset';

export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../packages/ui/src/**/*.{ts,tsx}',
    '../../services/*/ui/**/*.{ts,tsx}',
    '../external/*/**/*.{ts,tsx}',
  ],
};
