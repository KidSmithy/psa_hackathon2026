/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // PSA Singapore & Tuas Cyber-Maritime Light Theme Tokens
        psa: {
          navy: '#002B49',          // Authentic PSA Maritime Ultramarine
          'navy-dark': '#0B1E36',   // High-contrast deep navy ink for text
          'navy-light': '#E9F0F8',  // Soft maritime tint
          canvas: '#F0F4FA',        // Anti-glare cool maritime canvas
          surface: '#FFFFFF',       // Crisp white cards
          border: '#D5E2EE',        // Precision micro-border
          'border-focus': '#99BFDD',// Focused border
          muted: '#5A6E85',         // Technical telemetry & timestamps
          flame: '#E63946',         // PSA Signature Red Flame
          'flame-dark': '#C92A37',  // Critical hover state
          'flame-bg': '#FEF2F2',    // Critical alarm background
          'flame-border': '#FECDD3',// Critical alarm border
        },
        // Tuas Mega-Port Autonomous Electric Tokens
        tuas: {
          teal: '#00C9A7',          // Electric AGV & Smart Green Port Teal
          'teal-dark': '#00967D',   // Deep teal for high-contrast text
          'teal-light': '#E6FBF7',  // Soft teal pod background
          'teal-border': '#A7F3E2', // Glowing pod boundary
          cyan: '#00B4D8',          // Laser SCADA Cyan
          'cyan-dark': '#0284C7',   // Sky/Laser blue
          'cyan-light': '#EBF9FC',  // Micro badge background
          'cyan-border': '#BAE6FD', // Sky border
        },
        // Operational Status Tokens
        hazard: {
          red: '#E63946',           // PSA Flame Red
          'red-bg': '#FEF2F2',
          'red-border': '#FECDD3',
        },
        caution: {
          amber: '#D97706',         // High severity / thermal limit
          'amber-bg': '#FFFBEB',
          'amber-border': '#FDE68A',
        },
        nominal: {
          emerald: '#059669',       // Verified physical evidence / 0% contamination
          'emerald-bg': '#ECFDF5',
          'emerald-border': '#A7F3D0',
        },
      },
      boxShadow: {
        'glow-teal': '0 0 16px rgba(0, 201, 167, 0.25)',
        'glow-cyan': '0 0 16px rgba(0, 180, 216, 0.25)',
        'glow-flame': '0 0 16px rgba(230, 57, 70, 0.25)',
        'cyber-card': '0 2px 8px -2px rgba(0, 43, 73, 0.06), 0 1px 3px -1px rgba(0, 43, 73, 0.04)',
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
