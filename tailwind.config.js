/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'], mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'] },
      colors: {
        ink: { DEFAULT: '#14213D', soft: '#4A5568', mute: '#8392A5' },
        paper: { DEFAULT: '#FAF8F3', card: '#FFFFFF', line: '#E8E3D8' },
        brand: { 50: '#EAF6F3', 100: '#CDEAE3', 500: '#13846F', 600: '#0E6F5C', 700: '#0B594A', 900: '#073A31' },
        ember: { 50: '#FFF4E8', 500: '#F28C28', 600: '#D9741A' }
      },
      boxShadow: { soft: '0 1px 2px rgba(20,33,61,.05), 0 8px 24px -12px rgba(20,33,61,.12)' }
    }
  },
  plugins: []
}
