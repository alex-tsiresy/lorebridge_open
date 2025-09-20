/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      screens: {
        'xs': '475px',
        'h-sm': { 'raw': '(max-height: 500px)' },
        'h-md': { 'raw': '(max-height: 600px)' },
        'h-lg': { 'raw': '(max-height: 700px)' },
        'h-xl': { 'raw': '(max-height: 800px)' },
      },
    },
  },
  plugins: [],
} 