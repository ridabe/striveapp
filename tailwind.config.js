/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        bg: '#0E0E1A',
        surface: '#1A1A2E',
        border: '#2A2A45',
        primary: '#E8FF47',
        'text-primary': '#FFFFFF',
        'text-secondary': '#B0B0C3',
      },
      fontFamily: {
        syncopate: ['Syncopate_700Bold'],
        'dm-sans': ['DMSans_400Regular'],
        'dm-sans-medium': ['DMSans_500Medium'],
        'dm-sans-bold': ['DMSans_700Bold'],
      },
      borderRadius: {
        card: '12px',
        modal: '16px',
      },
    },
  },
  plugins: [],
};
