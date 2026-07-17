import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const partsDir = path.join(__dirname, "../src/components/chatapp-parts");
const outFile = path.join(__dirname, "../src/components/ChatApp.tsx");

const parts = fs
  .readdirSync(partsDir)
  .filter((n) => n.startsWith("part_"))
  .sort();
if (parts.length === 0) {
  console.error("assemble-chatapp: no part_* files in", partsDir);
  process.exit(1);
}
const body = parts
  .map((n) => fs.readFileSync(path.join(partsDir, n), "utf8"))
  .join("");
if (!body.includes("export function ChatApp") || !body.includes('"use client"')) {
  console.error("assemble-chatapp: assembled output looks invalid");
  process.exit(1);
}
fs.writeFileSync(outFile, body);
console.log(
  `assemble-chatapp: wrote ${outFile} (${body.length} bytes from ${parts.length} parts)`,
);
