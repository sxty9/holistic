import preset from '@holisdk/ui/tailwind-preset';

export default {
  presets: [preset],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    '../../holisdk/ui/src/**/*.{ts,tsx}',
    '../../services/*/ui/**/*.{ts,tsx}',
    '../external/*/**/*.{ts,tsx}',
  ],
};
