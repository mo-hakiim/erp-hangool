/**
 * Hangool theme. Every color comes from a CSS variable defined once in src/index.css
 * (the Hangool brand palette, taken from the company website). Change a color there, not here.
 * @type {import('tailwindcss').Config}
 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Brand
        primary: { DEFAULT: v("primary"), fg: v("primary-fg"), dark: v("primary-dark"), soft: v("primary-soft") },
        gold: { DEFAULT: v("gold"), fg: v("gold-fg"), soft: v("gold-soft") },
        surface: v("surface"),
        // Warm neutral scale derived from the brand neutrals (background, muted, border, muted text, text).
        neutral: {
          50: v("n-50"), 100: v("n-100"), 200: v("n-200"), 300: v("n-300"), 400: v("n-400"),
          500: v("n-500"), 600: v("n-600"), 700: v("n-700"), 800: v("n-800"), 900: v("n-900"),
        },
        danger: v("danger"),
      },
      fontFamily: {
        sans: ['"Nunito Sans"', "system-ui", "Segoe UI", "Roboto", "sans-serif"],
        display: ["Montserrat", '"Nunito Sans"', "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgb(var(--primary-dark) / 0.04), 0 6px 20px -10px rgb(var(--primary-dark) / 0.14)",
        lift: "0 2px 4px rgb(var(--primary-dark) / 0.05), 0 14px 32px -12px rgb(var(--primary-dark) / 0.22)",
      },
      borderRadius: { xl: "0.875rem", "2xl": "1.125rem" },
    },
  },
  plugins: [],
};
