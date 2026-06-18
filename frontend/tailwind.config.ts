import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#0b1c30",
        phase: "#6b38d4",
        teal: "#127c78",
        amber: "#b56b12",
      },
      boxShadow: {
        panel: "0 18px 55px rgba(19, 31, 48, 0.09)",
      },
      borderRadius: {
        phase: "8px",
      },
    },
  },
  plugins: [],
};

export default config;
