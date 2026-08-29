/**
 * Density helpers for gallery chrome — one poster mark, a short filter row.
 * Run: npx --yes tsx scripts/check-tile-chrome.ts
 */
import assert from "node:assert/strict";
import {
  galleryFilterChips,
  isPackFilter,
  pickPosterMark,
} from "../src/lib/tile-chrome";

function checkPosterMarkPriority() {
  assert.deepEqual(
    pickPosterMark({ mine: true, dedicatedPack: true, featured: true }),
    { kind: "mine", label: "Mine" },
  );
  assert.deepEqual(
    pickPosterMark({ dedicatedPack: true, featured: true }),
    { kind: "pack", label: "4K" },
  );
  assert.deepEqual(pickPosterMark({ featured: true }), {
    kind: "featured",
    label: "Featured",
  });
  assert.equal(pickPosterMark({}), null);
}

function checkFilterChipsStayShort() {
  assert.deepEqual(galleryFilterChips({ signedIn: false, resumeCount: 0 }), [
    "all",
    "featured",
  ]);
  assert.deepEqual(galleryFilterChips({ signedIn: false, resumeCount: 2 }), [
    "all",
    "mine",
    "featured",
  ]);
  assert.deepEqual(galleryFilterChips({ signedIn: true, resumeCount: 1 }), [
    "all",
    "mine",
    "owned",
    "featured",
  ]);
}

function checkPackFilterHelper() {
  assert.equal(isPackFilter("pack01"), true);
  assert.equal(isPackFilter("packs"), true);
  assert.equal(isPackFilter("all"), false);
  assert.equal(isPackFilter("mine"), false);
}

function main() {
  checkPosterMarkPriority();
  checkFilterChipsStayShort();
  checkPackFilterHelper();
  console.log("check-tile-chrome: ok");
}

main();
