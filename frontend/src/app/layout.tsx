import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Procharacters.cloud — Live Chat",
    template: "%s · Procharacters.cloud",
  },
  description: "Naughty Syntax live uncensored character chat — share cards, resume codes, custom models.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      "https://procharacters-web-production-7288.up.railway.app",
  ),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}