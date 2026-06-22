import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Design tokens — reference CSS variables
        primary:    'var(--color-primary)',
        background: 'var(--color-bg)',
        surface:    'var(--color-surface)',
        heading:    'var(--color-heading)',
        muted:      'var(--color-muted)',
        border:     'var(--color-border)',
        chrome:     'var(--color-chrome)',
        foreground: 'var(--foreground)',
        // Legacy aliases
        tibbna: {
          blue:     'var(--tibbna-blue)',
          blueDark: 'var(--tibbna-blue-dark)',
          gold:     '#D4A844',
          light:    'var(--tibbna-light)',
          muted:    '#B8D4F8',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', '-apple-system', '"Segoe UI"', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
