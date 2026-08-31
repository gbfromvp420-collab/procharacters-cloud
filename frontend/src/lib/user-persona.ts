export type Orientation = "gay" | "bi" | "straight";
export type Gender = "male" | "female" | "trans";
export type PlayPath = "gooner_guide" | "edging_buddies" | "custom";

export type UserPersona = {
  version: 1;
  completedAt?: string;
  skipped?: boolean;
  path: PlayPath | null;
  userName: string;
  userBio: string;
  userOrientation: Orientation | null;
  userGender: Gender | null;
  characterId: string | null;
  characterName: string;
  characterBio: string;
  characterOrientation: Orientation | null;
  characterGender: Gender | null;
  scenario: string;
};

const KEY = "procharacters.persona.v1";
const STARTER_KEY = "pc_studio_starter";

export const EMPTY_PERSONA: UserPersona = {
  version: 1,
  path: null,
  userName: "",
  userBio: "",
  userOrientation: null,
  userGender: null,
  characterId: null,
  characterName: "",
  characterBio: "",
  characterOrientation: null,
  characterGender: null,
  scenario: "",
};

export function loadPersona(): UserPersona | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as UserPersona;
    if (parsed.version !== 1) return null;
    return { ...EMPTY_PERSONA, ...parsed };
  } catch {
    return null;
  }
}

export function savePersona(persona: UserPersona): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(persona));
  } catch {
    /* ignore */
  }
}

export function skipPersona(): void {
  savePersona({
    ...EMPTY_PERSONA,
    ...(loadPersona() ?? {}),
    skipped: true,
    completedAt: new Date().toISOString(),
  });
}

/** True when signed-in users still need the taste questionnaire. */
export function needsPersona(): boolean {
  const p = loadPersona();
  if (!p) return true;
  if (p.skipped) return false;
  return !p.completedAt;
}

export const PATH_COPY: Record<
  PlayPath,
  { title: string; blurb: string; mode: "edge_pace" | "normal"; defaultBio: string }
> = {
  gooner_guide: {
    title: "Gooner Guide Master",
    blurb: "They hold the count. You leak. Finish is earned.",
    mode: "edge_pace",
    defaultBio:
      "Slow, cruel-soft goon guide. Counts, freezes, denies. You do not finish unless they say.",
  },
  edging_buddies: {
    title: "Edging Buddies",
    blurb: "Peer heat. Match pace. Hold together.",
    mode: "edge_pace",
    defaultBio:
      "Mutual edge buddy. Matches your pace, laughs when you leak, holds with you.",
  },
  custom: {
    title: "Custom heat",
    blurb: "Name them. Write the scene. Pick a face.",
    mode: "normal",
    defaultBio: "",
  },
};

export function buildPersonaStarter(p: UserPersona): string {
  const you = [p.userName.trim(), p.userOrientation, p.userGender, p.userBio.trim()]
    .filter(Boolean)
    .join(" · ");
  const them = [
    p.characterName.trim(),
    p.characterOrientation,
    p.characterGender,
    p.characterBio.trim(),
  ]
    .filter(Boolean)
    .join(" · ");
  const scene = p.scenario.trim();
  const parts = [
    you ? `I'm ${you}.` : "",
    them ? `You're ${them}.` : "",
    scene,
  ].filter(Boolean);
  return parts.join(" ").slice(0, 400);
}

export function stashPersonaStarter(characterId: string, starter: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      STARTER_KEY,
      JSON.stringify({ characterId, starter, at: Date.now() }),
    );
  } catch {
    /* ignore */
  }
}

export function personaChatHref(p: UserPersona): string {
  const id = p.characterId?.trim() || "twink-default";
  const path = p.path && p.path !== "custom" ? PATH_COPY[p.path] : PATH_COPY.custom;
  const q = new URLSearchParams({
    character: id,
    autostart: "1",
  });
  if (path.mode === "edge_pace") q.set("mode", "edge_pace");
  return `/chat?${q.toString()}`;
}
