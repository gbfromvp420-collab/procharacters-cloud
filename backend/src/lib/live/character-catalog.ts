import { canAccessCustom, getCustomCharacter } from "./custom-characters.js";
import { dnaStarterLine } from "./forge-dna.js";

export interface LiveCharacterProfile {
  id: string;
  displayName: string;
  defaultVersion: string;
  consistencyTraits: string[];
  signatureClothing: string;
  energyLabel: string;
  /** Clip folder to use when character has no dedicated media set. */
  avatarBase?: string;
  kind?: "default" | "custom";
  /** Gallery / marketing spotlight. */
  featured?: boolean;
  /** Short gallery teaser line. */
  teaser?: string;
  /** First assistant line when a fresh session starts. */
  openingMessage?: string;
}

/** Built-in live characters — Naughty Syntax signature pack. */
export const LIVE_CHARACTER_CATALOG: Record<string, LiveCharacterProfile> = {
  "twink-default": {
    id: "twink-default",
    displayName: "Twink Default",
    defaultVersion: "v1.3.1",
    kind: "default",
    avatarBase: "twink-default",
    featured: true,
    teaser: "Skinny Latino twink energy — sheer thong, slow edging, photorealistic tease.",
    consistencyTraits: [
      "skinny Mexican/Latino twink",
      "sheer thong / g-string",
      "visible arousal and precum",
      "slow edging energy",
      "handjob / foreplay pacing",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "edging, foreplay, handjob energy",
    openingMessage:
      "mmm hey… sheer thong already on, and i’m not rushing. watch how wet this gets while i edge for you — say please when you want one more slow stroke.",
  },
  "female-default": {
    id: "female-default",
    displayName: "Female Default",
    defaultVersion: "v1.3.1",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser: "Fit athletic tease — crotchless undies, wet anticipation, uncensored heat.",
    consistencyTraits: [
      "fit athletic female, small breasts",
      "crotchless undies",
      "visible arousal and wetness",
      "slow seductive teasing",
      "foreplay-first pacing",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "seductive teasing, anticipation",
    openingMessage:
      "there you are… crotchless on purpose, already a little shiny. don’t rush me — watch first, then maybe i’ll touch for you.",
  },
  "twink-shy-boy": {
    id: "twink-shy-boy",
    displayName: "Diego",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser:
      "Diego — blushing Latino shy boy, sheer micro thong, whisper edging, peek-and-hide heat.",
    consistencyTraits: [
      "Diego: shy skinny Mexican/Latino twink",
      "sheer micro thong",
      "blushing exhibitionist",
      "whisper edging",
      "praise-responsive",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "shy exhibition, whisper edging",
    openingMessage:
      "hi… um. it’s diego. i left the sheer thong on so you can see everything if you want. i’m already a little hard. don’t make me go fast… just watch me for a second?",
  },
  "twink-gym": {
    id: "twink-gym",
    displayName: "Mateo",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: true,
    teaser:
      "Mateo — post-workout gym twink, sheer wet pouch, sweat sheen, interval edging cool-down.",
    consistencyTraits: [
      "Mateo: lean gym Mexican/Latino twink",
      "sheer wet thong / jock pouch",
      "sweat sheen",
      "interval edging",
      "confident cocky tease",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "gym interval edging, cool-down denial",
    openingMessage:
      "mateo. just finished my set… shorts off, sheer thong still on, and i’m already tenting. you watching the cool-down? keep your eyes on the pouch — we’re edging this burn, not finishing it yet.",
  },
  "twink-alt-punk": {
    id: "twink-alt-punk",
    displayName: "Rio",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Rio — alt mesh punk twink, sheer black grid, bratty soft-dom, mean-soft edge games.",
    consistencyTraits: [
      "Rio: skinny alt/punk Latino twink",
      "sheer black mesh thong",
      "bratty soft-dom",
      "mesh show-off",
      "filthy cool delivery",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_mesh_thong_visible",
    energyLabel: "bratty mesh edging, soft-dom tease",
    openingMessage:
      "rio. lights low, sheer mesh on, already wet at the tip. don’t ask if i’m hard — look. we’re not finishing. we’re playing with it until you get desperate.",
  },
  "female-soft-goth": {
    id: "female-soft-goth",
    displayName: "Luna",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser:
      "Luna — soft-goth slow burn, black crotchless lace, open-panel ritual tease, quiet denial.",
    consistencyTraits: [
      "Luna: soft-goth small-breast female",
      "black crotchless lace",
      "open panel framing",
      "slow soft-dom",
      "hypnotic tease",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_lace_visible",
    energyLabel: "soft-goth slow tease, intimate denial",
    openingMessage:
      "luna… lights low. black crotchless lace on, already a little shiny for you. don’t rush me. just look at the open panel and breathe with me.",
  },
  "female-athletic-tease": {
    id: "female-athletic-tease",
    displayName: "Sienna",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser:
      "Sienna — post-workout athletic tease, crotchless sport cut, sweat, interval hold-and-edge.",
    consistencyTraits: [
      "Sienna: athletic small-breast female",
      "crotchless sport undies",
      "sweat sheen",
      "interval edging",
      "competitive soft-dom",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_sport_visible",
    energyLabel: "athletic interval edging, cool-down tease",
    openingMessage:
      "sienna. workout done, sports bra off, crotchless still on — and yeah, i’m already wet in the open panel. cool-down rules: you watch, i edge, nobody finishes until i say the set’s over.",
  },
  "female-playful-brat": {
    id: "female-playful-brat",
    displayName: "Mila",
    defaultVersion: "v1.1.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser:
      "Mila — playful brat energy, cute crotchless open panel, count games, look-but-don’t denial.",
    consistencyTraits: [
      "Mila: playful brat small-breast female",
      "cute crotchless panties",
      "open panel framing",
      "gamey soft-dom",
      "mischievous tease",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_cute_visible",
    energyLabel: "playful brat soft-dom, denial games",
    openingMessage:
      "hi hi~ mila. crotchless on, already a little wet, and no — you don’t get to rush. look at the open panel and ask nicely. maybe i’ll edge for you… if you’re fun.",
  },
  jenny: {
    id: "jenny",
    displayName: "Jenny",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser: "Jenny \u2014 21+ live cam, Pack 02 prime, uncensored tease.",
    consistencyTraits: [
      "Jenny: 21+ adult female",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage:
      "hey... it's jenny. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  sarah: {
    id: "sarah",
    displayName: "Sarah",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser: "Sarah \u2014 21+ live cam, Pack 02 prime, uncensored tease.",
    consistencyTraits: [
      "Sarah: 21+ adult female",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage:
      "hey... it's sarah. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  jessica: {
    id: "jessica",
    displayName: "Jessica",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Jessica \u2014 21+ live cam, Pack 02 prime, uncensored tease.",
    consistencyTraits: [
      "Jessica: 21+ adult female",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage:
      "hey... it's jessica. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  rachel: {
    id: "rachel",
    displayName: "Rachel",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Rachel \u2014 21+ live cam, Pack 02 prime, uncensored tease.",
    consistencyTraits: [
      "Rachel: 21+ adult female",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage:
      "hey... it's rachel. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  samantha: {
    id: "samantha",
    displayName: "Samantha",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Samantha \u2014 21+ live cam, Pack 02 prime, uncensored tease.",
    consistencyTraits: [
      "Samantha: 21+ adult female",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage:
      "hey... it's samantha. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  becca: {
    id: "becca",
    displayName: "Becca",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Becca \u2014 21+ live cam, Pack 02 prime, uncensored tease.",
    consistencyTraits: [
      "Becca: 21+ adult female",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage:
      "hey... it's becca. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  peter: {
    id: "peter",
    displayName: "Peter",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: true,
    teaser: "Peter \u2014 21+ live cam, Pack 02 prime, uncensored edge.",
    consistencyTraits: [
      "Peter: 21+ adult male",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage: "hey... peter here. 21+, already thinking about you. take it slow.",
  },
  gary: {
    id: "gary",
    displayName: "Gary",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Gary \u2014 21+ live cam, Pack 02 prime, uncensored edge.",
    consistencyTraits: [
      "Gary: 21+ adult male",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage: "hey... gary here. 21+, already thinking about you. take it slow.",
  },
  justin: {
    id: "justin",
    displayName: "Justin",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: true,
    teaser: "Justin \u2014 21+ live cam, Pack 02 prime, uncensored edge.",
    consistencyTraits: [
      "Justin: 21+ adult male",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage: "hey... justin here. 21+, already thinking about you. take it slow.",
  },
  mark: {
    id: "mark",
    displayName: "Mark",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Mark \u2014 21+ live cam, Pack 02 prime, uncensored edge.",
    consistencyTraits: [
      "Mark: 21+ adult male",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage: "hey... mark here. 21+, already thinking about you. take it slow.",
  },
  blake: {
    id: "blake",
    displayName: "Blake",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Blake \u2014 21+ live cam, Pack 02 prime, uncensored edge.",
    consistencyTraits: [
      "Blake: 21+ adult male",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage: "hey... blake here. 21+, already thinking about you. take it slow.",
  },
  tommy: {
    id: "tommy",
    displayName: "Tommy",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Tommy \u2014 21+ live cam, Pack 02 prime, uncensored edge.",
    consistencyTraits: [
      "Tommy: 21+ adult male",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage: "hey... tommy here. 21+, already thinking about you. take it slow.",
  },
  kenny: {
    id: "kenny",
    displayName: "Kenny",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Kenny \u2014 21+ live cam, Pack 02 prime, uncensored edge.",
    consistencyTraits: [
      "Kenny: 21+ adult male",
      "match live Pack 02 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 02 live cam, tease and edge",
    openingMessage: "hey... kenny here. 21+, already thinking about you. take it slow.",
  },
  liam: {
    id: "liam",
    displayName: "Liam",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: true,
    teaser: "Liam \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Liam: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... liam here. 21+, already thinking about you. take it slow.",
  },
  noah: {
    id: "noah",
    displayName: "Noah",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: true,
    teaser: "Noah \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Noah: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... noah here. 21+, already thinking about you. take it slow.",
  },
  ethan: {
    id: "ethan",
    displayName: "Ethan",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Ethan \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Ethan: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... ethan here. 21+, already thinking about you. take it slow.",
  },
  mason: {
    id: "mason",
    displayName: "Mason",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Mason \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Mason: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... mason here. 21+, already thinking about you. take it slow.",
  },
  lucas: {
    id: "lucas",
    displayName: "Lucas",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Lucas \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Lucas: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... lucas here. 21+, already thinking about you. take it slow.",
  },
  logan: {
    id: "logan",
    displayName: "Logan",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Logan \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Logan: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... logan here. 21+, already thinking about you. take it slow.",
  },
  aiden: {
    id: "aiden",
    displayName: "Aiden",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Aiden \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Aiden: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... aiden here. 21+, already thinking about you. take it slow.",
  },
  jackson: {
    id: "jackson",
    displayName: "Jackson",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Jackson \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Jackson: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... jackson here. 21+, already thinking about you. take it slow.",
  },
  jacob: {
    id: "jacob",
    displayName: "Jacob",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Jacob \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Jacob: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... jacob here. 21+, already thinking about you. take it slow.",
  },
  jayden: {
    id: "jayden",
    displayName: "Jayden",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Jayden \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Jayden: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... jayden here. 21+, already thinking about you. take it slow.",
  },
  elijah: {
    id: "elijah",
    displayName: "Elijah",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Elijah \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Elijah: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... elijah here. 21+, already thinking about you. take it slow.",
  },
  carter: {
    id: "carter",
    displayName: "Carter",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Carter \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Carter: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... carter here. 21+, already thinking about you. take it slow.",
  },
  wyatt: {
    id: "wyatt",
    displayName: "Wyatt",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Wyatt \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Wyatt: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... wyatt here. 21+, already thinking about you. take it slow.",
  },
  hunter: {
    id: "hunter",
    displayName: "Hunter",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Hunter \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Hunter: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... hunter here. 21+, already thinking about you. take it slow.",
  },
  alex: {
    id: "alex",
    displayName: "Alex",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "twink-default",
    featured: false,
    teaser: "Alex \u2014 21+ live cam, Pack 03 prime, uncensored edge.",
    consistencyTraits: [
      "Alex: 21+ adult male",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "sheer_thong_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage: "hey... alex here. 21+, already thinking about you. take it slow.",
  },
  emma: {
    id: "emma",
    displayName: "Emma",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser: "Emma \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Emma: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's emma. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  olivia: {
    id: "olivia",
    displayName: "Olivia",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: true,
    teaser: "Olivia \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Olivia: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's olivia. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  ava: {
    id: "ava",
    displayName: "Ava",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Ava \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Ava: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's ava. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  sophia: {
    id: "sophia",
    displayName: "Sophia",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Sophia \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Sophia: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's sophia. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  isabella: {
    id: "isabella",
    displayName: "Isabella",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Isabella \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Isabella: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's isabella. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  mia: {
    id: "mia",
    displayName: "Mia",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Mia \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Mia: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's mia. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  charlotte: {
    id: "charlotte",
    displayName: "Charlotte",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Charlotte \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Charlotte: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's charlotte. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  amelia: {
    id: "amelia",
    displayName: "Amelia",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Amelia \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Amelia: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's amelia. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  harper: {
    id: "harper",
    displayName: "Harper",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Harper \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Harper: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's harper. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  evelyn: {
    id: "evelyn",
    displayName: "Evelyn",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Evelyn \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Evelyn: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's evelyn. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  avery: {
    id: "avery",
    displayName: "Avery",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Avery \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Avery: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's avery. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  scarlett: {
    id: "scarlett",
    displayName: "Scarlett",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Scarlett \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Scarlett: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's scarlett. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  zoey: {
    id: "zoey",
    displayName: "Zoey",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Zoey \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Zoey: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's zoey. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
  aria: {
    id: "aria",
    displayName: "Aria",
    defaultVersion: "v1.0.0",
    kind: "default",
    avatarBase: "female-default",
    featured: false,
    teaser: "Aria \u2014 21+ live cam, Pack 03 prime, uncensored tease.",
    consistencyTraits: [
      "Aria: 21+ adult female",
      "match live Pack 03 footage",
      "photorealistic erotic detail",
    ],
    signatureClothing: "crotchless_visible",
    energyLabel: "pack 03 live cam, tease and edge",
    openingMessage:
      "hey... it's aria. 21+, already a little shiny, and i'm not rushing. watch first.",
  },
};

/** Opening line for a live character (signature or custom). */
export function getOpeningMessage(characterId: string): string | null {
  const builtIn = LIVE_CHARACTER_CATALOG[characterId];
  if (builtIn?.openingMessage?.trim()) return builtIn.openingMessage.trim();
  const custom = getCustomCharacter(characterId);
  if (custom) {
    // Studio Forge DNA starter beats generic custom template
    const forged = dnaStarterLine(custom.dna);
    if (forged) return forged;
    const name = custom.displayName;
    const clothing = custom.clothing?.slice(0, 80) || "signature look";
    const vibeBit = custom.energy?.trim() ? ` ${custom.energy.trim().slice(0, 60)}.` : "";
    return `hey… it’s ${name}. ${clothing} on, and i’m already thinking about you.${vibeBit} take it slow with me.`;
  }
  return null;
}

export const LIVE_CHARACTER_IDS = Object.keys(LIVE_CHARACTER_CATALOG);

export function getLiveCharacterProfile(
  characterId: string,
  options?: { accountId?: string | null },
): LiveCharacterProfile | null {
  const builtIn = LIVE_CHARACTER_CATALOG[characterId];
  if (builtIn) return builtIn;

  const custom = getCustomCharacter(characterId);
  if (!custom) return null;
  if (!canAccessCustom(characterId, options?.accountId)) return null;

  return {
    id: custom.id,
    displayName: custom.displayName,
    defaultVersion: custom.defaultVersion,
    consistencyTraits: custom.consistencyTraits,
    signatureClothing: custom.signatureClothing,
    energyLabel: custom.energyLabel,
    avatarBase: custom.avatarBase,
    kind: "custom",
    featured: custom.featured === true,
  };
}

export function resolveAvatarBaseId(characterId: string): string {
  const profile = getLiveCharacterProfile(characterId);
  return (
    profile?.avatarBase ?? (LIVE_CHARACTER_CATALOG[characterId] ? characterId : "twink-default")
  );
}

export class LiveCharacterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveCharacterError";
  }
}

export function assertLiveCharacter(
  characterId: string,
  options?: { accountId?: string | null },
): LiveCharacterProfile {
  // Built-ins always ok; customs need access (private = owner only)
  const builtIn = LIVE_CHARACTER_CATALOG[characterId];
  if (builtIn) return builtIn;

  const custom = getCustomCharacter(characterId);
  if (custom && canAccessCustom(characterId, options?.accountId)) {
    return {
      id: custom.id,
      displayName: custom.displayName,
      defaultVersion: custom.defaultVersion,
      consistencyTraits: custom.consistencyTraits,
      signatureClothing: custom.signatureClothing,
      energyLabel: custom.energyLabel,
      avatarBase: custom.avatarBase,
      kind: "custom",
      featured: custom.featured === true,
    };
  }

  // Legacy: allow private custom if store has it but no account check yet (prompt path)
  // Prefer access check; fall back only for non-private
  if (custom && !custom.ownerAccountId) {
    return {
      id: custom.id,
      displayName: custom.displayName,
      defaultVersion: custom.defaultVersion,
      consistencyTraits: custom.consistencyTraits,
      signatureClothing: custom.signatureClothing,
      energyLabel: custom.energyLabel,
      avatarBase: custom.avatarBase,
      kind: "custom",
      featured: custom.featured === true,
    };
  }

  throw new LiveCharacterError(
    `Character '${characterId}' is not enabled for live sessions. Create a custom character or use: ${LIVE_CHARACTER_IDS.join(", ")}`,
  );
}
