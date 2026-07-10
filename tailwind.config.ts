import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        ink: "#111827",
        line: "#e5e7eb",
        paper: "#ffffff",
        muted: "#6b7280"
      }
    }
  },
  plugins: []
};

export default config;
