import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PSP Workbench",
    short_name: "PSP",
    description: "Personal Software Process time tracking.",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0f14",
    theme_color: "#0d0f14",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
