import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#141414",
        paper: "#f6f3ea",
        accent: "#0f766e",
      },
    },
  },
  plugins: [],
};

export default config;
