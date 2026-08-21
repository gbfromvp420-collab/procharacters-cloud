import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = dirname(fileURLToPath(import.meta.url));

/** Repo root: procharacters-cloud/ (or REPO_ROOT in Docker/production). */
export function resolveRepoRoot(): string {
  if (process.env.REPO_ROOT) {
    return resolve(process.env.REPO_ROOT);
  }
  return resolve(moduleDir, "../../..");
}

export function repoPath(...segments: string[]): string {
  return join(resolveRepoRoot(), ...segments);
}
