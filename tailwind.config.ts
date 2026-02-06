import type { Config } from "tailwindcss";

export default {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        kasa: {
          // Primary Blues
          blue: {
            300: '#195c8c',
            200: '#3d779f',
            100: '#6493b3',
          },
          // Neutrals
          black: {
            500: '#061332',
          },
          neutral: {
            warm: '#faf9f6',
            light: '#ebecef',
            medium: '#e6e7ea',
            dark: '#acb0ba',
          },
          // Accents
          success: '#2eab6e',
          error: '#e23c00',
          warning: '#ff9520',
          // Decorative
          dusk: '#ef786a',
          sunshine: '#f8dab7',
          overcast: '#3d8c8d',
        },
      },
      fontFamily: {
        sans: ['TT Norms Pro', 'Inter', 'helvetica', 'arial', 'sans-serif'],
        serif: ['Tiempos Headline', 'baskerville', 'palatino', 'georgia', 'serif'],
      },
      borderRadius: {
        kasa: '12px',
        'kasa-sm': '8px',
        'kasa-lg': '16px',
      },
      spacing: {
        'kasa-button': '3rem',
        'kasa-button-md': '2.5rem',
        'kasa-button-sm': '2rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
