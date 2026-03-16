/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // IFM Brand — The True IFM
        primary: '#EF5B21',
        'primary-hover': '#d14a1a',
        'primary-light': '#ff8c5a',
        secondary: '#000000',
        // Dark mode (Zinc scale)
        'background-dark': '#09090b',
        'surface-dark': '#18181b',
        'border-dark': '#27272a',
        // Light mode
        'background-light': '#ffffff',
        'surface-light': '#f4f4f5',
        'border-light': '#e4e4e7',
        'text-muted': '#71717a',
        'code-bg': '#0d0b16',
        'error-red': '#ff0040',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'grid-pattern': 'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)',
        'card-dark': '0 1px 3px 0 rgb(0 0 0 / 0.3)',
      },
    },
  },
  plugins: [],
}
