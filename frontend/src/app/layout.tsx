import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Procharacters.cloud — Live Chat",
  description: "Naughty Syntax live character chat (v2 MVP)",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}