import type { Metadata } from "next";
import Link from "next/link";
import { CharacterCardView } from "@/components/CharacterCardView";
import { absoluteMediaUrl, fetchCharacterCard } from "@/lib/character-card";

interface PageProps {
  params: Promise<{ id: string }>;
}

function siteOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    "https://procharacters-web-production-7288.up.railway.app"
  );
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const card = await fetchCharacterCard(id);
  const origin = siteOrigin();

  if (!card) {
    return {
      title: "Character not found · Procharacters.cloud",
      description: "This Naughty Syntax character card is unavailable.",
    };
  }

  const title = `${card.displayName} · Naughty Syntax`;
  const description = card.teaser;
  const image = absoluteMediaUrl(card.posterClip, origin);
  const url = `${origin}${card.cardPath}`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      siteName: "Procharacters.cloud",
      type: "website",
      images: [{ url: image, width: 720, height: 960, alt: card.displayName }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

export default async function CharacterCardPage({ params }: PageProps) {
  const { id } = await params;
  const card = await fetchCharacterCard(id);
  const origin = siteOrigin();

  if (!card) {
    return (
      <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-semibold text-brand-text">Character not found</h1>
        <p className="text-sm text-brand-muted">
          This card may be a custom model that isn’t on this server, or the link is outdated.
        </p>
        <Link
          href="/"
          className="rounded-lg border border-brand-border px-5 py-2.5 text-sm text-brand-text"
        >
          Back to gallery
        </Link>
        <Link
          href="/chat"
          className="rounded-lg bg-brand-accent px-5 py-2.5 text-sm font-medium text-white"
        >
          Open live chat
        </Link>
      </main>
    );
  }

  return <CharacterCardView card={card} siteOrigin={origin} />;
}
