import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          bg: "#0a0a0f",
          panel: "#12121a",
          panelElevated: "#181822",
          border: "#2a2a3a",
          borderSoft: "#1e1e2a",
          accent: "#e11d8f",
          accentDim: "#9d1470",
          accentGlow: "rgba(225, 29, 143, 0.35)",
          text: "#f4f4f8",
          muted: "#9ca3af",
          soft: "#6b7280",
        },
      },
      fontFamily: {
        sans: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        glow: "0 0 40px -8px rgba(225, 29, 143, 0.45)",
        "glow-sm": "0 0 24px -6px rgba(225, 29, 143, 0.35)",
        card: "0 12px 40px -12px rgba(0, 0, 0, 0.55)",
      },
      backgroundImage: {
        "brand-mesh":
          "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(225, 29, 143, 0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 100% 100%, rgba(99, 20, 140, 0.22), transparent 50%), radial-gradient(ellipse 40% 30% at 0% 80%, rgba(225, 29, 143, 0.08), transparent 45%)",
      },
      spacing: {
        "safe-b": "env(safe-area-inset-bottom, 0px)",
        "safe-t": "env(safe-area-inset-top, 0px)",
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
      animation: {
        "fade-in": "fade-in 0.35s ease-out both",
        "rise-in": "rise-in 0.4s ease-out both",
        "hero-crossfade": "hero-crossfade 0.7s ease-out both",
        "hero-fadeout": "hero-fadeout 0.7s ease-out both",
        "hero-progress": "hero-progress linear both",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "rise-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "hero-crossfade": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "hero-fadeout": {
          from: { opacity: "1" },
          to: { opacity: "0" },
        },
        "hero-progress": {
          from: { transform: "scaleX(0)" },
          to: { transform: "scaleX(1)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
