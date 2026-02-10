/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        /* ── Casino-aligned palette ──
           These map the existing CSS-variable tokens into Tailwind so both
           `casino-*` utility classes and standard Tailwind classes share
           the same visual language. */
        casino: {
          dark:      '#0A0A0F',
          surface:   '#1B1B2F',
          border:    '#2C2C3A',
          gold:      '#FFD700',
          'gold-dark': '#FFA000',
          green:     '#00C853',
          red:       '#E53935',
          blue:      '#00B0FF',
          purple:    '#6A1B9A',
          text:      '#F5F5F5',
          muted:     '#B0B0B0',
        },
        primary: {
          50:  '#FFF9E6',
          100: '#FFF0B3',
          200: '#FFE680',
          300: '#FFDB4D',
          400: '#FFD11A',
          500: '#FFD700',   // casino gold
          600: '#FFA000',   // casino gold-dark
          700: '#E68A00',
          800: '#CC7A00',
          900: '#996600',
        },
        secondary: {
          50:  '#F3E5F5',
          100: '#E1BEE7',
          200: '#CE93D8',
          300: '#BA68C8',
          400: '#AB47BC',
          500: '#6A1B9A',   // casino purple
          600: '#5C1690',
          700: '#4A1178',
          800: '#380D5E',
          900: '#260844',
        },
        accent: {
          50:  '#E0F7FA',
          100: '#B3E5FC',
          200: '#81D4FA',
          300: '#4FC3F7',
          400: '#29B6F6',
          500: '#00B0FF',   // casino blue
          600: '#0091EA',
          700: '#0077C2',
          800: '#005C9A',
          900: '#004272',
        },
        success: {
          50:  '#E8F5E9',
          100: '#C8E6C9',
          200: '#A5D6A7',
          300: '#81C784',
          400: '#66BB6A',
          500: '#00C853',   // casino green
          600: '#00A844',
          700: '#00873A',
          800: '#006830',
          900: '#004D24',
        },
        warning: {
          50:  '#FFFBEB',
          100: '#FEF3C7',
          500: '#F59E0B',
          600: '#D97706',
          700: '#B45309',
          900: '#78350F',
        },
        error: {
          50:  '#FEF2F2',
          100: '#FEE2E2',
          200: '#FECACA',
          300: '#FCA5A5',
          400: '#F87171',
          500: '#E53935',   // casino red
          600: '#DC2626',
          700: '#B91C1C',
          800: '#991B1B',
          900: '#7F1D1D',
        },
        neutral: {
          50:  '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'bounce-gentle': 'bounceGentle 2s infinite',
        'slide-out-right': 'slideOutRight 0.2s ease-in forwards',
        'typing-dot': 'typingDot 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        slideOutRight: {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(100%)', opacity: '0' },
        },
        typingDot: {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '30%': { transform: 'translateY(-4px)', opacity: '1' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
}
