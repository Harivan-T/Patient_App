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
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.96)' },
          to:   { opacity: '1', transform: 'scale(1)' },
        },
        shimmer: {
          from: { backgroundPosition: '200% 0' },
          to:   { backgroundPosition: '-200% 0' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to:   { transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up':  'fade-up 0.35s ease-out both',
        'fade-in':  'fade-in 0.3s ease-out both',
        'scale-in': 'scale-in 0.25s ease-out both',
        shimmer:    'shimmer 1.8s linear infinite',
        'sheet-up': 'sheet-up 0.3s cubic-bezier(0.32, 0.72, 0, 1) both',
      },
    },
  },
  plugins: [],
};
export default config;
