export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#17675E', hover: '#203D38', tint: '#E8F2EE' },
        ink: '#243B3A',
        muted: '#61716E',
        line: '#D9DFD9',
        page: '#F5F4EF',
        surface: '#FFFFFF',
        subtle: { DEFAULT: '#E9ECE7', 2: '#EDF0EA' },
        scanner: '#20312F',
        danger: { DEFAULT: '#A13C32', bg: '#FBEDE8' },
        warn: { DEFAULT: '#79551E', bg: '#FBF1DC' },
        overlay: 'rgba(32, 49, 47, 0.4)',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        mono: ['"Source Code Pro"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { DEFAULT: '6px', card: '10px', modal: '12px' },
    },
  },
  plugins: [],
};
