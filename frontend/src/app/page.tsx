import type { Metadata } from "next";
import { GalleryView } from "@/components/GalleryView";
import { fetchCharacterGallery } from "@/lib/character-card";

export const metadata: Metadata = {
  title: "Live character gallery",
  description:
    "Browse Naughty Syntax live models and custom characters. Share cards or start uncensored chat.",
};

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://procharacters-web-production-7288.up.railway.app"
  );
}

export default async function HomePage() {
  const characters = await fetchCharacterGallery();
  return <GalleryView characters={characters} siteOrigin={siteOrigin()} />;
}
