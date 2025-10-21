/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,ts,tsx}',
    './src/**/*.{js,ts,tsx}', // todas las subcarpetas y archivos dentro de src
    './components/**/*.{js,ts,tsx}', // si quieres mantener esta aparte
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {},
  },
  plugins: [],
};
