/**
 * Scan frontend/public/avatar for dedicated packs and write packs/status.json
 *
 * Usage (from backend/):
 *   npm run avatar:check-packs
 *   npm run avatar:check-packs -- --write
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  avatarRootPath,
  buildPackStatusFile,
  listPackStatuses,
  phase4PackIds,
} from "../src/lib/media/avatar-packs.js";

const write = process.argv.includes("--write");

const root = avatarRootPath();
console.log(`\n🎬 Avatar pack check`);
console.log(`   root: ${root ?? "(not found — run from monorepo)"}\n`);

const statuses = listPackStatuses();
const phase4 = new Set(phase4PackIds());

for (const s of statuses) {
  if (!phase4.has(s.id) && s.id !== "twink-default" && s.id !== "female-default") {
    continue;
  }
  const mark = s.ready ? "✓ READY " : "· interim";
  const miss = s.missing.length ? ` missing=[${s.missing.join(",")}]` : "";
  console.log(`  ${mark}  ${s.id.padEnd(24)} base=${s.avatarBase}${miss}`);
}

const file = buildPackStatusFile();
console.log(
  `\n   dedicated ready: ${file.ready.filter((id) => phase4.has(id)).join(", ") || "(none yet)"}`,
);

if (write && root) {
  const outDir = join(root, "packs");
  mkdirSync(outDir, { recursive: true });
  const outPath = join(outDir, "status.json");
  writeFileSync(outPath, `${JSON.stringify(file, null, 2)}\n`, "utf8");
  console.log(`   wrote ${outPath}`);
} else if (write) {
  console.log("   --write skipped (avatar root not found)");
}

console.log("");
