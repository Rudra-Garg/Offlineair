/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: '#4A9EFF',
        dark: '#0A0A0F',
        muted: '#8E8E93'
      }
    },
  },
  plugins: [],
}

