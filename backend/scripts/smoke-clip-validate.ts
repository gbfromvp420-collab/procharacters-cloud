/**
 * Smoke test for clip content-type + magic-byte validation.
 * Run: npx tsx scripts/smoke-clip-validate.ts
 */
import {
  assertDeclaredClipMime,
  sniffClipFormat,
  validateClipUpload,
} from "../src/lib/media/clip-validate.js";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

// Minimal ISO BMFF / ftyp header + padding
const mp4 = Buffer.alloc(2048);
mp4.writeUInt32BE(32, 0);
mp4.write("ftyp", 4, "ascii");
mp4.write("isom", 8, "ascii");

// WebM EBML header + padding
const webm = Buffer.alloc(2048);
webm[0] = 0x1a;
webm[1] = 0x45;
webm[2] = 0xdf;
webm[3] = 0xa3;

const junk = Buffer.from("not a video file " + "x".repeat(2000));
const html = Buffer.from("<!DOCTYPE html><html>" + "x".repeat(2000));
const aviClaim = Buffer.from("RIFF" + "xxxx" + "AVI " + "x".repeat(2000));

assert(sniffClipFormat(mp4) === "mp4", "sniff mp4");
assert(sniffClipFormat(webm) === "webm", "sniff webm");
assert(sniffClipFormat(junk) === null, "sniff junk");

const okMp4 = validateClipUpload({
  buffer: mp4,
  filename: "idle.mp4",
  mimeType: "video/mp4",
});
assert(okMp4.ok && okMp4.format === "mp4", "accept real mp4");

const okWebm = validateClipUpload({
  buffer: webm,
  filename: "teasing.webm",
  mimeType: "video/webm",
});
assert(okWebm.ok && okWebm.format === "webm", "accept real webm");

const okOctet = validateClipUpload({
  buffer: mp4,
  filename: "playful.mp4",
  mimeType: "application/octet-stream",
});
assert(okOctet.ok, "octet-stream + good magic ok");

const badMime = validateClipUpload({
  buffer: mp4,
  filename: "idle.mp4",
  mimeType: "video/avi",
});
assert(!badMime.ok && badMime.code === "BAD_MIME", "reject video/avi");

const mismatch = validateClipUpload({
  buffer: mp4,
  filename: "idle.webm",
  mimeType: "video/webm",
});
assert(!mismatch.ok, "reject mime/ext vs magic mismatch");

const badExt = validateClipUpload({
  buffer: mp4,
  filename: "idle.mov",
  mimeType: "video/mp4",
});
assert(!badExt.ok && badExt.code === "BAD_EXT", "reject .mov");

const badMagic = validateClipUpload({
  buffer: junk,
  filename: "idle.mp4",
  mimeType: "video/mp4",
});
assert(!badMagic.ok && badMagic.code === "BAD_MAGIC", "reject junk magic");

const badHtml = validateClipUpload({
  buffer: html,
  filename: "idle.mp4",
  mimeType: "video/mp4",
});
assert(!badHtml.ok, "reject html disguised as mp4");

const declared = assertDeclaredClipMime("image/png");
assert(declared && declared.code === "BAD_MIME", "assertDeclared rejects image");

const declaredOk = assertDeclaredClipMime("video/mp4");
assert(declaredOk === null, "assertDeclared allows video/mp4");

// video/* free-for-all must be gone
const freeForAll = assertDeclaredClipMime("video/x-msvideo");
assert(freeForAll !== null, "no bare video/*");

console.log("smoke-clip-validate: all checks passed");
console.log({
  okMp4,
  okWebm,
  badMime,
  mismatch: mismatch.ok ? "unexpected ok" : mismatch,
  aviBytes: sniffClipFormat(aviClaim),
});
