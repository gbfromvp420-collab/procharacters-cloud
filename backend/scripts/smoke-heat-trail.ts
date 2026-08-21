/**
 * Heat trail derivation checks — multi-device reclaim stamp.
 * Run: npx --yes tsx scripts/smoke-heat-trail.ts
 */
import assert from "node:assert/strict";
import {
  dnaLabelFromNodeId,
  heatDepthFromCount,
  heatTrailFromSessionNotes,
  recapFromSessionNotes,
} from "../src/lib/memory/heat-trail.js";

function checkRecapPrefersLastBeat() {
  const notes =
    'Session with Liam: ~4 turn(s). Ongoing vibe: heat · edge; sheer fabric / wet outline focus. Scene lock: pose=on knees; act=slow stroke; clothing="sheer thong". Last character beat: “Stay right there — don’t you dare.” Stay consistent.';
  const recap = recapFromSessionNotes(notes);
  assert.equal(recap, "Stay right there — don’t you dare.");
}

function checkRecapFallsBackToScene() {
  const notes =
    'Scene lock: pose=leaning in; act=french kiss; clothing="mesh pouch". Ongoing vibe: heat · warm.';
  const recap = recapFromSessionNotes(notes);
  assert.ok(recap?.includes("leaning in"));
  assert.ok(recap?.includes("french kiss"));
}

function checkTrailStampsDnaAndChips() {
  const trail = heatTrailFromSessionNotes({
    sessionNotes:
      'Ongoing vibe: heat · edge; edging / denial pacing; sheer fabric / wet outline focus. Scene lock: pose=on knees; act=handjob over fabric; clothing="sheer g-string"; arousal=edge. DNA tree · Edge ↑. Last character beat: “Hold it.”',
    messageCount: 8,
    dnaTreeNodeId: "edge-hold",
  });
  assert.equal(trail.recapLine, "Hold it.");
  assert.equal(trail.heatDepth, "edge");
  assert.equal(trail.dnaTreeLabel, "Edge");
  assert.ok(trail.heatChips?.some((c) => /DNA Edge/i.test(c)));
  assert.ok(trail.heatChips?.some((c) => /sheer/i.test(c) || /g-string/i.test(c)));
}

function checkEmptyNotesStillDepthFromCount() {
  const trail = heatTrailFromSessionNotes({
    sessionNotes: "",
    messageCount: 14,
    dnaTreeNodeId: "tease-1",
  });
  assert.equal(trail.heatDepth, "deep");
  assert.equal(trail.dnaTreeLabel, "Tease");
  assert.equal(trail.recapLine, undefined);
}

function checkDnaLabels() {
  assert.equal(dnaLabelFromNodeId("deny-gate"), "Deny");
  assert.equal(dnaLabelFromNodeId("release-now"), "Release");
  assert.equal(dnaLabelFromNodeId("soft-lock"), "Soft lock");
  assert.equal(heatDepthFromCount(1), "spark");
  assert.equal(heatDepthFromCount(7), "edge");
  assert.equal(heatDepthFromCount(22), "locked");
}

const checks = [
  checkRecapPrefersLastBeat,
  checkRecapFallsBackToScene,
  checkTrailStampsDnaAndChips,
  checkEmptyNotesStillDepthFromCount,
  checkDnaLabels,
];

for (const fn of checks) fn();
console.log(`ok ${checks.length} heat-trail checks`);
