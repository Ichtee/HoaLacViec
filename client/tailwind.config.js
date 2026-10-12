/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        green: {
          main: '#3E7A50',
          dark: '#285C3A',
          light: '#EAF5E8',
          50: '#EAF5E8',
          100: '#D5ECD1',
          200: '#AAD9A3',
          300: '#7FC675',
          400: '#5DB056',
          500: '#3E7A50',
          600: '#346B45',
          700: '#306140',
          800: '#285C3A',
          900: '#1A3D26',
        },
        pink: {
          main: '#F3AFC3',
          light: '#FDEBF1',
          dark: '#B83D6A',
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
          muted: '#566759',
          light: '#64776A',
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
        // Layered, green-tinted shadows: a tight contact shadow + a soft ambient one.
        card: '0 1px 2px rgba(36, 60, 44, 0.05), 0 8px 24px -6px rgba(36, 60, 44, 0.10)',
        'card-hover': '0 2px 4px rgba(36, 60, 44, 0.06), 0 16px 40px -8px rgba(36, 60, 44, 0.20)',
        modal: '0 24px 70px -12px rgba(36, 60, 44, 0.30)',
        brand: '0 6px 18px -4px rgba(62, 122, 80, 0.45)',
        pink: '0 6px 18px -4px rgba(213, 80, 130, 0.40)',
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #4A8C5D 0%, #3E7A50 55%, #306140 100%)',
        'pink-gradient': 'linear-gradient(135deg, #F7AFCB 0%, #EF8FB0 100%)',
        'hero-gradient':
          'radial-gradient(60% 80% at 85% 0%, rgba(243,175,195,0.35) 0%, transparent 60%), radial-gradient(70% 90% at 0% 10%, rgba(170,217,163,0.45) 0%, transparent 60%), linear-gradient(180deg, #F4FAF2 0%, #FFFDF6 100%)',
      },
    },
  },
  plugins: [],
};
