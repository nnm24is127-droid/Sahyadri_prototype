/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0f9f3',
          100: '#dbf0e3',
          200: '#bae2cb',
          300: '#8dcead',
          400: '#5ab48b',
          500: '#38986f',
          600: '#2a7c59',
          700: '#236348',
          800: '#1e4f3b',
          900: '#1b4132',
          950: '#0c241b',
        },
        earth: {
          50: '#fbf8f3',
          100: '#f5eee3',
          200: '#ebd9c5',
          300: '#dec0a1',
          400: '#ce9f75',
          500: '#c28555',
          600: '#b46f47',
          700: '#96573c',
          800: '#794735',
          900: '#633c2e',
        },
        sunshine: {
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
