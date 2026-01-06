/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#e1f5ff',
          100: '#b3e0ff',
          200: '#81cbff',
          300: '#4fb6ff',
          400: '#29a5ff',
          500: '#0095ff',
          600: '#0087f5',
          700: '#0075e0',
          800: '#0064cc',
          900: '#0047ab',
        },
      },
    },
  },
  plugins: [],
}
