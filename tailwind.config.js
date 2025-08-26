/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#000000',
        'sidebar-bg': '#181818',
        'chat-bg': '#212121',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

