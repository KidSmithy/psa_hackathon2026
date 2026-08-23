/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Light Theme Tokens
        light: {
          bg: '#F8FAFC',        // Slate 50
          card: '#FFFFFF',      // White
          surface: '#F1F5F9',   // Slate 100
          border: '#E2E8F0',    // Slate 200
          hover: '#E2E8F0',
          text: '#0F172A',      // Slate 900
          muted: '#64748B',     // Slate 500
        },
        // Maritime Port Brand Tokens
        port: {
          cyan: '#0284C7',      // Sky 600
          'cyan-glow': '#0EA5E9',
          blue: '#2563EB',      // Blue 600
          navy: '#0F172A',
        },
        // Industrial Status Tokens
        hazard: {
          red: '#DC2626',       // Red 600
          'red-bg': '#FEF2F2',  // Red 50
          'red-border': '#FECACA',
        },
        caution: {
          amber: '#D97706',     // Amber 600
          'amber-bg': '#FFFBEB',// Amber 50
          'amber-border': '#FDE68A',
        },
        nominal: {
          emerald: '#059669',   // Emerald 600
          'emerald-bg': '#ECFDF5',
          'emerald-border': '#A7F3D0',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1.2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'radar-sweep': 'spin 4s linear infinite',
      }
    },
  },
  plugins: [],
}
