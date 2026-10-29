/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Driven by the palette in src/utils/themes.ts; defaults live in index.css.
        base: 'rgb(var(--wf-base) / <alpha-value>)',
        surface: 'rgb(var(--wf-surface) / <alpha-value>)',
        card: 'rgb(var(--wf-card) / <alpha-value>)',
        elevated: 'rgb(var(--wf-elevated) / <alpha-value>)',
        hairline: 'rgb(var(--wf-line) / 0.08)',
        muted: 'rgb(var(--wf-muted) / <alpha-value>)',
        subtle: 'rgb(var(--wf-subtle) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--wf-accent) / <alpha-value>)',
          soft: 'rgb(var(--wf-accent-soft) / <alpha-value>)',
          blue: 'rgb(var(--wf-accent-alt) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
      fontSize: {
        base: ['13px', { lineHeight: '1.55' }],
      },
      borderRadius: {
        xl: '0.75rem',
        '2xl': '1rem',
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset',
        lift: '0 12px 28px -14px rgba(0,0,0,0.85)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'fade-up': 'fade-up 180ms cubic-bezier(0.16,1,0.3,1)',
        'slide-in-right': 'slide-in-right 160ms cubic-bezier(0.16,1,0.3,1)',
      },
      transitionDuration: {
        DEFAULT: '150ms',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
