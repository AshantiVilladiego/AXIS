import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // A.X.I.S. Civic Tech Palette
        slate: {
          50: '#F8FAFC', // App Background
          200: '#E2E8F0', // Borders
          900: '#0F172A', // Sidebar & Primary Text
        },
        indigo: {
          600: '#4F46E5', // Primary CTA & Active States
        },
        emerald: {
          600: '#059669', // Success & AI Confidence Badges
        }
      },
    },
  },
  plugins: [],
}

export default config
