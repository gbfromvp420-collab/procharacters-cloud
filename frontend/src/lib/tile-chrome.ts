/**
 * Gallery density helpers — one mark on a poster, a short filter row.
 * Keep filters URL-compatible; just hide the extra chips from the floor.
 */

export type PosterMarkKind = "mine" | "pack" | "featured";

export function pickPosterMark(input: {
  mine?: boolean;
  dedicatedPack?: boolean;
  featured?: boolean;
}): { kind: PosterMarkKind; label: string } | null {
  if (input.mine) return { kind: "mine", label: "Mine" };
  if (input.dedicatedPack) return { kind: "pack", label: "4K" };
  if (input.featured) return { kind: "featured", label: "Featured" };
  return null;
}

export type GalleryChipKey = "all" | "mine" | "owned" | "featured";

/** Primary filter chips only — packs live in a compact select. */
export function galleryFilterChips(opts: {
  signedIn: boolean;
  resumeCount: number;
}): GalleryChipKey[] {
  const chips: GalleryChipKey[] = ["all"];
  if (opts.signedIn || opts.resumeCount > 0) chips.push("mine");
  if (opts.signedIn) chips.push("owned");
  chips.push("featured");
  return chips;
}

export const GALLERY_CHIP_LABEL: Record<GalleryChipKey, string> = {
  all: "All",
  mine: "My chats",
  owned: "My models",
  featured: "Featured",
};

export type GallerySortMode = "featured" | "recent" | "name";

export const GALLERY_SORT_OPTIONS: Array<{ value: GallerySortMode; label: string }> = [
  { value: "featured", label: "Featured" },
  { value: "recent", label: "Last chat" },
  { value: "name", label: "Name A–Z" },
];

export function isPackFilter(filter: string): boolean {
  return filter === "packs" || filter === "pack01" || filter === "pack02" || filter === "pack03";
}
