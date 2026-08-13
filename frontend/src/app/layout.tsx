import type { Metadata, Viewport } from "next";
import { AgeFloor } from "@/components/AgeFloor";
import { PwaBootstrap } from "@/components/PwaBootstrap";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Procharacters.cloud — Live Chat",
    template: "%s · Procharacters.cloud",
  },
  description:
    "Naughty Syntax live uncensored character chat — share cards, resume codes, custom models.",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ||
      "https://procharacters-web-production-7288.up.railway.app",
  ),
  applicationName: "Procharacters",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icons/icon.svg", type: "image/svg+xml" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Procharacters",
  },
  formatDetection: {
    telephone: false,
  },
  // Helps iOS “Add to Home Screen” + Android install prompts for Web Push reliability
  other: {
    "mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0f" },
    { media: "(prefers-color-scheme: light)", color: "#0a0a0f" },
  ],
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh">
        <PwaBootstrap />
        <AgeFloor />
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){function w(n){if(n.nodeType===3&&n.nodeValue){n.nodeValue=n.nodeValue.replace(/Uncensored 18\\+/g,"Uncensored 21+").replace(/18\\+ · KGC/g,"21+ · KGC").replace(/18-year-old/gi,"21+").replace(/18 year old/gi,"21+").replace(/\\b18yo\\b/gi,"21+")}else if(n.childNodes){for(var i=0;i<n.childNodes.length;i++)w(n.childNodes[i])}}w(document.documentElement)})();',
          }}
        />
      </body>
    </html>
  );
}
