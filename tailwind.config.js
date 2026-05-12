/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        cyberpunk: {
          dark: '#0a0e27',
          darker: '#050a15',
          accent: '#00d9ff',
          accent2: '#ff006e',
          accent3: '#8338ec',
          accent4: '#ffbe0b',
          glow: '#00fff0',
        }
      },
      boxShadow: {
        'neon-cyan': '0 0 10px rgba(0, 217, 255, 0.5), 0 0 20px rgba(0, 217, 255, 0.3)',
        'neon-pink': '0 0 10px rgba(255, 0, 110, 0.5), 0 0 20px rgba(255, 0, 110, 0.3)',
        'neon-purple': '0 0 10px rgba(131, 56, 236, 0.5), 0 0 20px rgba(131, 56, 236, 0.3)',
        'neon-glow': '0 0 20px rgba(0, 255, 240, 0.4), 0 0 40px rgba(0, 217, 255, 0.2)',
      },
      animation: {
        'pulse-glow': 'pulse-glow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-in': 'slide-in 0.5s ease-out',
        'rank-change': 'rank-change 0.6s ease-out',
      },
      keyframes: {
        'pulse-glow': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
        'slide-in': {
          'from': { opacity: '0', transform: 'translateX(-10px)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
        'rank-change': {
          '0%': { transform: 'scale(1) translateY(0)' },
          '50%': { transform: 'scale(1.05) translateY(-5px)' },
          '100%': { transform: 'scale(1) translateY(0)' },
        },
      },
      fontFamily: {
        'cyber': ['Orbitron', 'monospace'],
        'body': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
