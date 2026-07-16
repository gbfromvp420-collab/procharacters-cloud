import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const partsDir = path.join(__dirname, "../src/components/chatapp-parts");
const outFile = path.join(__dirname, "../src/components/ChatApp.tsx");

const shards = fs
  .readdirSync(partsDir)
  .filter((n) => /^h\d{2}$/.test(n))
  .sort();

if (shards.length === 0) {
  console.error("assemble-chatapp: no hNN shards in", partsDir);
  process.exit(1);
}

const hex = shards
  .map((n) => fs.readFileSync(path.join(partsDir, n), "utf8"))
  .join("")
  .replace(/\s+/g, "");

if (hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
  console.error("assemble-chatapp: invalid hex", hex.length);
  process.exit(1);
}

const body = Buffer.from(hex, "hex").toString("utf8");
if (!body.includes("export function ChatApp") || !body.includes('"use client"')) {
  console.error("assemble-chatapp: assembled output looks invalid");
  process.exit(1);
}
fs.writeFileSync(outFile, body);
console.log(
  `assemble-chatapp: wrote ${outFile} (${body.length} bytes from ${shards.length} shards)`,
);
