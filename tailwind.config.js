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
        'message-bg': '#303030',
      },
      keyframes: {
        'slide-in-from-bottom': {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      },
      animation: {
        'slide-in-from-bottom-4': 'slide-in-from-bottom 0.3s ease-out',
      }
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}

