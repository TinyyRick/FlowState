/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        background: '#f8fafc', 
        surface: '#ffffff', 
        primary: '#334155',
        secondary: '#94a3b8',
        accent: '#6366f1',
        'accent-soft': '#e0e7ff',
        danger: '#f43f5e',
        success: '#10b981',
        warning: '#f59e0b',
        'warm-bg': '#f5f5f4',
      },
      boxShadow: {
        'neu-out': '6px 6px 12px #cbd5e1, -6px -6px 12px #ffffff',
        'neu-pressed': 'inset 4px 4px 8px #cbd5e1, inset -4px -4px 8px #ffffff',
        'soft-xl': '0 20px 40px -10px rgba(0,0,0,0.05)',
        'glow': '0 0 15px rgba(99, 102, 241, 0.3)',
      },
      animation: {
        'shake': 'shake 0.82s cubic-bezier(.36,.07,.19,.97) both infinite',
      },
      keyframes: {
        shake: {
          '10%, 90%': { transform: 'translate3d(-1px, 0, 0)' },
          '20%, 80%': { transform: 'translate3d(2px, 0, 0)' },
          '30%, 50%, 70%': { transform: 'translate3d(-4px, 0, 0)' },
          '40%, 60%': { transform: 'translate3d(4px, 0, 0)' }
        }
      }
    },
  },
  plugins: [],
}