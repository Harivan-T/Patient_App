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
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        // Tibbna brand colors — matched from logo
        tibbna: {
          blue:   '#6BC9E4',   // primary sky-blue (circles + V)
          blueDark: '#4AAFC8', // darker shade for hover
          gold:   '#D4A844',   // accent amber (diamond)
          light:  '#EDF8FC',   // very light blue background tint
          muted:  '#B8E4F2',   // muted blue for borders/dividers
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
export default config;
