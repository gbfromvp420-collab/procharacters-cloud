/** Live catalog pack membership. Keep in sync with frontend/src/lib/pack-lanes.ts */

export const PACK_01_IDS = [
  "twink-default",
  "female-default",
  "twink-shy-boy",
  "twink-gym",
  "twink-alt-punk",
  "female-soft-goth",
  "female-athletic-tease",
  "female-playful-brat",
] as const;

export const PACK_02_IDS = [
  "jenny",
  "sarah",
  "jessica",
  "rachel",
  "samantha",
  "becca",
  "peter",
  "gary",
  "justin",
  "mark",
  "blake",
  "tommy",
  "kenny",
] as const;

export const PACK_03_IDS = [
  "liam",
  "noah",
  "ethan",
  "mason",
  "lucas",
  "logan",
  "aiden",
  "jackson",
  "jacob",
  "jayden",
  "elijah",
  "carter",
  "wyatt",
  "hunter",
  "alex",
  "emma",
  "olivia",
  "ava",
  "sophia",
  "isabella",
  "mia",
  "charlotte",
  "amelia",
  "harper",
  "evelyn",
  "avery",
  "scarlett",
  "zoey",
  "aria",
] as const;

export type PackLane = "01" | "02" | "03";

const PACK_01 = new Set<string>(PACK_01_IDS);
const PACK_02 = new Set<string>(PACK_02_IDS);
const PACK_03 = new Set<string>(PACK_03_IDS);

export function packLaneFor(id: string): PackLane | null {
  if (PACK_01.has(id)) return "01";
  if (PACK_02.has(id)) return "02";
  if (PACK_03.has(id)) return "03";
  return null;
}
