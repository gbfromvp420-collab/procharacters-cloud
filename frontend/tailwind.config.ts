import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0a0a0f",
          panel: "#12121a",
          border: "#2a2a3a",
          accent: "#e11d8f",
          accentDim: "#9d1470",
          text: "#f4f4f8",
          muted: "#9ca3af",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;