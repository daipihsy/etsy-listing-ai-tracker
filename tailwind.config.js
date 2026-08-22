/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        etsy: '#F1641E',
        ink: '#1f2328'
      }
    }
  },
  plugins: []
}
