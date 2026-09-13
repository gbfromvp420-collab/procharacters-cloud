/**
 * Guard the 21+ age gate: real interstitial, children held, persistence helpers.
 * Run: npx --yes tsx scripts/check-age-gate.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AGE_GATE_COOKIE,
  AGE_GATE_STORAGE_KEY,
  AGE_GATE_TTL_MS,
  buildAgeVerifiedCookie,
  isAgeVerifiedFromSources,
  isAgeVerifiedTimestamp,
  readAgeCookie,
} from "../src/lib/age-gate";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const floor = readFileSync(join(root, "src/components/AgeFloor.tsx"), "utf8");
const layout = readFileSync(join(root, "src/app/layout.tsx"), "utf8");

function main() {
  const now = 1_700_000_000_000;
  assert.equal(isAgeVerifiedTimestamp(null, now), false);
  assert.equal(isAgeVerifiedTimestamp("nope", now), false);
  assert.equal(isAgeVerifiedTimestamp(String(now - 1000), now), true);
  assert.equal(isAgeVerifiedTimestamp(String(now - AGE_GATE_TTL_MS - 1), now), false);

  assert.equal(readAgeCookie(`${AGE_GATE_COOKIE}=${now}; Path=/`), String(now));
  assert.equal(
    isAgeVerifiedFromSources({
      cookieHeader: `${AGE_GATE_COOKIE}=${now}`,
      now,
    }),
    true,
  );
  assert.equal(
    isAgeVerifiedFromSources({
      localStorageValue: String(now),
      now,
    }),
    true,
  );
  assert.match(buildAgeVerifiedCookie(now), new RegExp(`${AGE_GATE_COOKIE}=${now}`));
  assert.match(buildAgeVerifiedCookie(now), /SameSite=Lax/);

  assert.match(floor, /age-gate-title/);
  assert.match(floor, /I am 21 or older/);
  assert.match(floor, /I am under 21/);
  assert.match(floor, /data-age-gate-hold/);
  assert.match(floor, /localStorage/);
  assert.match(floor, /document\.cookie/);
  assert.equal(
    /if\s*\(\s*allowed\s*\)\s*\{\s*return null/.test(floor),
    false,
    "AgeFloor must not no-op after hydrate",
  );
  assert.match(floor, /return <>\{children\}<\/>/);
  assert.match(layout, /<AgeFloor>\s*\{children\}<\/AgeFloor>/);
  assert.match(floor, /AGE_GATE_STORAGE_KEY/);

  console.log("check-age-gate: ok");
}

main();
