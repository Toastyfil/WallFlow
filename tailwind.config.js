/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0a0a0b',
        surface: '#0f0f11',
        card: '#141416',
        elevated: '#1b1b1e',
        hairline: 'rgba(255,255,255,0.075)',
        muted: '#8b8b93',
        subtle: '#63636b',
        accent: {
          DEFAULT: '#7b7cf0',
          soft: '#aaabf7',
          blue: '#5b8def',
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
