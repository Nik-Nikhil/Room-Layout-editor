/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: 'var(--ink)', soft: 'var(--ink-soft)' },
        paper: 'var(--paper)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface2)' },
        line: 'var(--line)',
        accent: { DEFAULT: 'var(--accent)', fg: 'var(--accent-fg)' },
        bad: 'var(--bad)',
        good: 'var(--good)',
        hint: 'var(--hint)',
        'header-bg': 'var(--header-bg)',
        'header-fg': 'var(--header-fg)',
        'header-border': 'var(--header-border)',
        'panel-bg': 'var(--panel-bg)',
        'panel-header': 'var(--panel-header)',
        'swatch-ring': 'var(--swatch-ring)',
        'toolbar-bg': 'var(--toolbar-bg)',
        'toolbar-fg': 'var(--toolbar-fg)',
        'status-bg': 'var(--status-bg)',
        'status-fg': 'var(--status-fg)',
      },
    },
  },
  plugins: [],
}
