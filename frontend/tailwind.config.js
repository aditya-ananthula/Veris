/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#0a0b10',
          900: '#101218',
          850: '#151923',
          800: '#1c2130',
          700: '#262d42',
        },
        accent: {
          400: '#8b7cf6',
          500: '#7c6cf4',
          600: '#6a5ae0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
