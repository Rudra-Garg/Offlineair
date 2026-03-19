/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind v4 requires this
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./constants/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: '#4A9EFF',
        dark: '#0A0A0F',
        muted: '#8E8E93',
      },
    },
  },
  plugins: [],
};
