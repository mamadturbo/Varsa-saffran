/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        crimson: {
          50: '#fcf3f3',
          100: '#f9e6e6',
          200: '#f0cccc',
          300: '#e0a8a8',
          400: '#c97070',
          500: '#a83838',
          600: '#8B0000',
          700: '#720000',
          800: '#5c0000',
          900: '#480000',
          950: '#2e0000',
        },
        gold: {
          50: '#fbf7ef',
          100: '#f5ecda',
          200: '#ead7b6',
          300: '#ddbd92',
          400: '#d4b884',
          500: '#C9A96E',
          600: '#b8965a',
          700: '#92733f',
          800: '#6f5630',
          900: '#4d3c22',
        },
        // Semantic surface/text tokens — driven by CSS variables so they
        // automatically adapt to the active theme (dark or light).
        ink: {
          600: 'rgb(var(--ink-600) / <alpha-value>)',
          700: 'rgb(var(--ink-700) / <alpha-value>)',
          800: 'rgb(var(--ink-800) / <alpha-value>)',
          900: 'rgb(var(--ink-900) / <alpha-value>)',
          950: 'rgb(var(--ink-950) / <alpha-value>)',
        },
        cream: {
          50: 'rgb(var(--cream-50) / <alpha-value>)',
          100: 'rgb(var(--cream-100) / <alpha-value>)',
          200: 'rgb(var(--cream-200) / <alpha-value>)',
          300: 'rgb(var(--cream-300) / <alpha-value>)',
          400: 'rgb(var(--cream-400) / <alpha-value>)',
          500: 'rgb(var(--cream-500) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['"Noto Nastaliq Urdu"', 'Vazirmatn', 'serif'],
        sans: ['Vazirmatn', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        gold: '0 0 0 1px rgba(201,169,110,0.35), 0 0 24px -6px rgba(201,169,110,0.45)',
        'gold-lg': '0 0 0 1px rgba(201,169,110,0.4), 0 18px 50px -12px rgba(201,169,110,0.5)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(28px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slow-zoom': {
          '0%': { transform: 'scale(1.08)' },
          '100%': { transform: 'scale(1.18)' },
        },
        'ken-burns': {
          '0%': { transform: 'scale(1) translateX(0)' },
          '100%': { transform: 'scale(1.12) translateX(-1.5%)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        },
        'drawer-in': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.9s cubic-bezier(0.22,1,0.36,1) both',
        'fade-in': 'fade-in 1.1s ease both',
        'slow-zoom': 'slow-zoom 12s ease-out forwards',
        'ken-burns': 'ken-burns 9s ease-out forwards',
        'drawer-in': 'drawer-in 0.4s cubic-bezier(0.22,1,0.36,1) both',
        'scale-in': 'scale-in 0.5s cubic-bezier(0.22,1,0.36,1) both',
      },
      transitionTimingFunction: {
        luxe: 'cubic-bezier(0.22,1,0.36,1)',
      },
    },
  },
  plugins: [],
};
