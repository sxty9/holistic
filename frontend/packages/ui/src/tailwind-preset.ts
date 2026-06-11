/* Tailwind preset that maps the CSS design tokens into the theme, so SDK and service
   components use semantic utilities (bg-surface, text-primary, rounded-card, shadow-elev-2,
   backdrop-blur-vibrancy). Consumed by the app's tailwind.config.ts. */

const v = (name: string) => `var(--${name})`;

const preset = {
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: v('accent'), hover: v('accent-hover'), fg: v('accent-fg') },
        bg: { base: v('bg-base') },
        surface: { DEFAULT: v('surface'), raised: v('surface-raised'), sidebar: v('sidebar') },
        separator: v('separator'),
        text: { primary: v('text-primary'), secondary: v('text-secondary'), tertiary: v('text-tertiary') },
        success: v('success'),
        warning: v('warning'),
        danger: v('danger'),
      },
      borderRadius: {
        xs: v('radius-xs'),
        sm: v('radius-sm'),
        md: v('radius-md'),
        card: v('radius-card'),
        lg: v('radius-lg'),
        '2xl': v('radius-2xl'),
      },
      boxShadow: {
        'elev-1': v('shadow-1'),
        'elev-2': v('shadow-2'),
        'elev-3': v('shadow-3'),
      },
      backdropBlur: { vibrancy: '30px', thin: '20px' },
      fontFamily: {
        sans: ['-apple-system', 'SF Pro Text', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['SF Mono', 'JetBrains Mono', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        caption: ['12px', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        footnote: ['13px', { lineHeight: '1.35', letterSpacing: '-0.01em' }],
        subhead: ['15px', { lineHeight: '1.4', letterSpacing: '-0.015em' }],
        body: ['17px', { lineHeight: '1.45', letterSpacing: '-0.022em' }],
        title3: ['20px', { lineHeight: '1.3', letterSpacing: '-0.015em' }],
        title2: ['22px', { lineHeight: '1.25', letterSpacing: '-0.018em' }],
        title1: ['28px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],
        largeTitle: ['34px', { lineHeight: '1.15', letterSpacing: '-0.022em' }],
      },
      transitionTimingFunction: { out: v('ease-out'), spring: v('ease-spring') },
      transitionDuration: { fast: '120ms', base: '220ms', slow: '360ms' },
    },
  },
};

export default preset;
