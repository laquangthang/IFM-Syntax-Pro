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
        // IFM Research Brand Colors
        primary: '#EF5B21', // IFM Orange
        'primary-dark': '#d14a1a',
        'primary-light': '#ff6b38',
        'primary-glow': 'rgba(239, 91, 33, 0.5)',
        secondary: '#000000', // Research Black
        'background-dark': '#050505',
        'background-light': '#FDFDFD',
        'surface-dark': '#161022',
        'surface-dark-lighter': '#1f1b27',
        'surface-border': '#2e2839',
        'text-muted': '#a69cba',
        'glass-border-dark': 'rgba(255, 255, 255, 0.1)',
        'glass-border-light': 'rgba(0, 0, 0, 0.1)',
        'glass-bg-dark': 'rgba(255, 255, 255, 0.05)',
        'glass-bg-light': 'rgba(0, 0, 0, 0.05)',
        'neon-purple': '#a855f7',
        'neon-cyan': '#06b6d4',
        'neon-amber': '#f59e0b',
        'code-bg': '#0d0b16',
        'cyan-glow': '#00f0ff',
        'error-red': '#ff0040', // Electric Red for logic errors
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      backgroundImage: {
        'cyber-grid': 'linear-gradient(to right, rgba(89, 13, 242, 0.1) 1px, transparent 1px), linear-gradient(to bottom, rgba(89, 13, 242, 0.1) 1px, transparent 1px)',
        'grid-pattern': 'linear-gradient(to right, rgba(255, 255, 255, 0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.03) 1px, transparent 1px)',
      },
      boxShadow: {
        'neon': '0 0 20px rgba(239, 91, 33, 0.15)',
        'neon-strong': '0 0 30px rgba(239, 91, 33, 0.3)',
        'glow-purple': '0 0 30px rgba(168, 85, 247, 0.5)',
        'glow-cyan': '0 0 30px rgba(6, 182, 212, 0.5)',
        'glow-orange': '0 0 30px rgba(239, 91, 33, 0.5)',
      },
      keyframes: {
        'glow-pulse': {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgba(239, 91, 33, 0.4), 0 0 40px rgba(239, 91, 33, 0.2)',
            opacity: '1',
          },
          '50%': { 
            boxShadow: '0 0 40px rgba(239, 91, 33, 0.8), 0 0 60px rgba(239, 91, 33, 0.4)',
            opacity: '0.9',
          },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'laser-scan': {
          '0%': { transform: 'translateX(-100%)', opacity: '0' },
          '50%': { opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
      },
      animation: {
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'spin-slow': 'spin 12s linear infinite',
        'laser-scan': 'laser-scan 2s linear infinite',
      },
    },
  },
  plugins: [],
}
