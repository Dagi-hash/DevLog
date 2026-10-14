import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The app is fully client-rendered from localStorage, so Cache Components
  // (and Activity-preserved hidden routes) add nothing here.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
