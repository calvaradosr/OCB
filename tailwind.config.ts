import type { Config } from "tailwindcss";

// One Consulting Business brand palette (from logo)
const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#A8862B", dark: "#8A6E20" },
        secondary: { DEFAULT: "#DFC172", soft: "#F3E8C8" },
        ink: "#2B2620",
        muted: "#7A6F5C",
        canvas: "#FAF8F2",
        success: "#3E7C4A",
        warning: "#C77B22",
        danger: "#B0382E"
      }
    }
  },
  plugins: []
};
export default config;
