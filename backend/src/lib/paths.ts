import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** Repo root: procharacters-cloud/ (three levels up from backend/src/lib). */
export function resolveRepoRoot(): string {
  return resolve(moduleDir, "../../..");
}

export function repoPath(...segments: string[]): string {
  return join(resolveRepoRoot(), ...segments);
}