import type { MediaClipKey } from "./types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export interface CharacterCard {
  id: string;
  displayName: string;
  kind: "default" | "custom";
  brand: string;
  energyLabel: string;
  teaser: string;
  tags: string[];
  avatarBase: string;
  posterClip: string;
  clips: Record<MediaClipKey, string>;
  ctaPath: string;
  cardPath: string;
}

export async function fetchCharacterCard(characterId: string): Promise<CharacterCard | null> {
  try {
    const res = await fetch(
      `${API_BASE}/api/v1/characters/${encodeURIComponent(characterId)}/card`,
      { next: { revalidate: 30 } },
    );
    if (!res.ok) return null;
    return (await res.json()) as CharacterCard;
  } catch {
    return null;
  }
}

/** Resolve clip URL against the public web origin when relative. */
export function absoluteMediaUrl(mediaPath: string, origin?: string): string {
  if (/^https?:\/\//i.test(mediaPath)) return mediaPath;
  const base =
    origin ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "https://procharacters-web-production-7288.up.railway.app";
  if (mediaPath.startsWith("/")) return `${base.replace(/\/$/, "")}${mediaPath}`;
  return `${base.replace(/\/$/, "")}/${mediaPath}`;
}
