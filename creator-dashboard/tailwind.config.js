/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#000000",
        "canvas-alt": "#0A0A0A",
        ink: {
          DEFAULT: "#FFFFFF",
          secondary: "#CCCCCC",
          muted: "#A0A0A0",
        },
        hairline: {
          DEFAULT: "rgba(255, 255, 255, 0.22)",
          subtle: "rgba(255, 255, 255, 0.12)",
        },
        cta: {
          bg: "#FFFFFF",
          fg: "#000000",
        },
      },
      fontFamily: {
        serif: ['"Playfair Display"', "Georgia", "Times New Roman", "serif"],
        sans: ['Inter', "system-ui", "-apple-system", "sans-serif"],
      },
      maxWidth: {
        content: "960px",
      },
      boxShadow: {
        cta: "0 1px 2px rgba(0, 0, 0, 0.08), 0 8px 24px -4px rgba(0, 0, 0, 0.12)",
      },
    },
  },
  plugins: [],
};
