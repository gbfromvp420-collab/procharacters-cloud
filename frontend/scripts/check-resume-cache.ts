/**
 * Multi-device resume cache merge — server trail wins on a fresh phone.
 * Run: npx --yes tsx scripts/check-resume-cache.ts
 */
import assert from "node:assert/strict";
import type { AccountSessionSummary } from "../src/lib/api";
import {
  mergeAccountSessionTrail,
  type ResumeCacheEntry,
} from "../src/lib/resume-cache";

function serverJenny(): AccountSessionSummary {
  return {
    sessionId: "sess-jenny-1",
    characterId: "jenny",
    characterName: "Jenny",
    status: "active",
    messageCount: 9,
    resumeCode: "AB12CD",
    resumeExpiresAt: "2026-08-28T00:00:00.000Z",
    updatedAt: "2026-08-21T12:00:00.000Z",
    createdAt: "2026-08-21T10:00:00.000Z",
    sessionMode: "edge_pace",
    dnaTreeNodeId: "edge-hold",
    dnaTreeLabel: "Edge",
    recapLine: "Stay hovering — don’t rush her.",
    heatDepth: "edge",
    heatChips: ["DNA Edge", "hover first", "open panel"],
  };
}

function checkFreshDeviceGetsServerTrail() {
  const merged = mergeAccountSessionTrail(undefined, serverJenny());
  assert.ok(merged);
  assert.equal(merged!.recapLine, "Stay hovering — don’t rush her.");
  assert.equal(merged!.dnaTreeLabel, "Edge");
  assert.equal(merged!.dnaTreeNodeId, "edge-hold");
  assert.equal(merged!.heatDepth, "edge");
  assert.deepEqual(merged!.heatChips, ["DNA Edge", "hover first", "open panel"]);
  assert.equal(merged!.source, "account");
}

function checkDifferentSessionDropsStaleRecap() {
  const stale: ResumeCacheEntry = {
    characterId: "jenny",
    characterName: "Jenny",
    sessionId: "sess-old",
    resumeCode: "OLDOLD",
    updatedAt: "2026-08-20T12:00:00.000Z",
    source: "local",
    recapLine: "Yesterday’s cold line that must not leak",
    heatChips: ["stale chip"],
    heatDepth: "spark",
    dnaTreeNodeId: "spark",
    dnaTreeLabel: "Spark",
  };
  const merged = mergeAccountSessionTrail(stale, serverJenny());
  assert.ok(merged);
  assert.equal(merged!.sessionId, "sess-jenny-1");
  assert.equal(merged!.recapLine, "Stay hovering — don’t rush her.");
  assert.notEqual(merged!.recapLine, stale.recapLine);
  assert.deepEqual(merged!.heatChips, ["DNA Edge", "hover first", "open panel"]);
  assert.equal(merged!.dnaTreeLabel, "Edge");
}

function checkSameSessionKeepsLocalWhenServerBlank() {
  const prev: ResumeCacheEntry = {
    characterId: "jenny",
    characterName: "Jenny",
    sessionId: "sess-jenny-1",
    resumeCode: "AB12CD",
    updatedAt: "2026-08-21T11:00:00.000Z",
    source: "local",
    recapLine: "Local recap from this phone",
    heatChips: ["local chip"],
    heatDepth: "warm",
    mindTag: "Slow hover",
  };
  const blank: AccountSessionSummary = {
    ...serverJenny(),
    recapLine: undefined,
    heatChips: undefined,
    heatDepth: undefined,
    dnaTreeLabel: undefined,
    dnaTreeNodeId: undefined,
    sessionMode: "normal",
  };
  const merged = mergeAccountSessionTrail(prev, blank);
  assert.ok(merged);
  assert.equal(merged!.recapLine, "Local recap from this phone");
  assert.deepEqual(merged!.heatChips, ["local chip"]);
  assert.equal(merged!.mindTag, "Slow hover");
}

function checkNewerLocalAccountWins() {
  const newer: ResumeCacheEntry = {
    characterId: "jenny",
    sessionId: "sess-jenny-1",
    resumeCode: "AB12CD",
    updatedAt: "2026-08-21T18:00:00.000Z",
    source: "account",
    recapLine: "Already stamped newer",
  };
  const olderList = {
    ...serverJenny(),
    updatedAt: "2026-08-21T12:00:00.000Z",
  };
  const merged = mergeAccountSessionTrail(newer, olderList);
  assert.equal(merged, newer);
}

function checkServerLabelBeatsDerived() {
  const merged = mergeAccountSessionTrail(undefined, {
    ...serverJenny(),
    dnaTreeNodeId: "deny-now",
    dnaTreeLabel: "Deny",
  });
  assert.equal(merged?.dnaTreeLabel, "Deny");
}

const checks = [
  checkFreshDeviceGetsServerTrail,
  checkDifferentSessionDropsStaleRecap,
  checkSameSessionKeepsLocalWhenServerBlank,
  checkNewerLocalAccountWins,
  checkServerLabelBeatsDerived,
];

for (const fn of checks) fn();
console.log(`ok ${checks.length} resume-cache merge checks`);
