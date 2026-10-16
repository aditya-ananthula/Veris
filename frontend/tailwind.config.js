/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  safelist: ['bg-ink-950', 'text-ink-950', 'border-ink-950'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#08080d',
          900: '#0b0b12',
          850: '#101018',
          800: '#171722',
          700: '#262633',
        },
        accent: {
          300: '#ddd6fe',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        violet: {
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
        },
        emerald: {
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      backgroundImage: {
        'mesh-gradient': 'radial-gradient(at 0% 0%, hsla(258, 80%, 62%, 0.32) 0px, transparent 55%), radial-gradient(at 100% 0%, hsla(271, 76%, 60%, 0.26) 0px, transparent 55%), radial-gradient(at 0% 100%, hsla(160, 60%, 45%, 0.20) 0px, transparent 55%), radial-gradient(at 100% 100%, hsla(243, 68%, 64%, 0.28) 0px, transparent 55%)',
      },
      boxShadow: {
        'soft': '0 4px 20px rgba(0,0,0,0.25)',
        'soft-lg': '0 10px 40px -10px rgba(0,0,0,0.45)',
        'glow-cyan': '0 0 40px rgba(139,92,246,0.18)',
        'glow-violet': '0 0 40px rgba(168,85,247,0.20)',
        'glow-haze': '0 0 22px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.08)',
        'glow-emerald': '0 0 22px rgba(52,211,153,0.30), inset 0 1px 0 rgba(255,255,255,0.08)',
        'neon-violet': '0 0 30px rgba(139,92,246,0.35)',
        'neon-emerald': '0 0 30px rgba(16,185,129,0.30)',
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
    },
  },
  plugins: [],
};
