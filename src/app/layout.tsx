import type { Metadata, Viewport } from "next";
import { Inter, Newsreader } from "next/font/google";
import { AppShell } from "@/components/AppShell";
import "./globals.css";

// A sans for the interface, a serif for titles and the figures worth looking at.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
  axes: ["opsz"],
});

export const metadata: Metadata = {
  title: {
    default: "DevLog",
    template: "%s — DevLog",
  },
  description: "Personal Software Process time tracking for manual, AI-assisted and agentic engineering.",
  applicationName: "DevLog",
  appleWebApp: {
    capable: true,
    title: "DevLog",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${newsreader.variable} antialiased`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
