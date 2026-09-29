/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          main: '#4D9363',
          dark: '#285C3A',
          light: '#EAF5E8',
          50: '#EAF5E8',
          100: '#D5ECD1',
          200: '#AAD9A3',
          300: '#7FC675',
          400: '#5DB056',
          500: '#4D9363',
          600: '#3E7A50',
          700: '#306140',
          800: '#285C3A',
          900: '#1A3D26',
        },
        pink: {
          main: '#F3AFC3',
          light: '#FDEBF1',
          50: '#FDEBF1',
          100: '#FBCFDF',
          200: '#F7AFCB',
          300: '#F3AFC3',
          400: '#EF8FB0',
          500: '#E8709A',
          600: '#D55082',
          700: '#B83D6A',
          800: '#8C2D50',
          900: '#611E38',
        },
        cream: '#FFFDF6',
        text: {
          main: '#243C2C',
          muted: '#6B7A6F',
          light: '#9BB09F',
        },
      },
      fontFamily: {
        sans: ['"Be Vietnam Pro"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        xl: '16px',
        '2xl': '20px',
        '3xl': '24px',
        '4xl': '32px',
      },
      boxShadow: {
        card: '0 4px 20px rgba(36, 60, 44, 0.08)',
        'card-hover': '0 8px 32px rgba(36, 60, 44, 0.14)',
        modal: '0 20px 60px rgba(36, 60, 44, 0.18)',
      },
    },
  },
  plugins: [],
};
