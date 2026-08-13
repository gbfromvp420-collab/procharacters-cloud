/** Canonical product age floor. Rewrite leftover 18+ copy in forge/custom DNA. */
export const AGE_FLOOR = "21+";

export function applyAgeFloor(text: string): string {
  return text
    .replace(/consenting adult 18\+/gi, `consenting adult ${AGE_FLOOR}`)
    .replace(/Uncensored 18\+/g, `Uncensored ${AGE_FLOOR}`)
    .replace(/adult \(18\+\)/g, `adult (${AGE_FLOOR})`)
    .replace(/adults \(18\+\)/g, `adults (${AGE_FLOOR})`)
    .replace(/18-year-old/gi, AGE_FLOOR)
    .replace(/18 year old/gi, AGE_FLOOR)
    .replace(/\b18yo\b/gi, AGE_FLOOR);
}
