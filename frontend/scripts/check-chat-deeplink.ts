/**
 * Unit checks for autostart / character deep-link decisions.
 * Run: npx --yes tsx scripts/check-chat-deeplink.ts
 */
import assert from "node:assert/strict";
import {
  hasPendingShareDeepLink,
  resolveCharacterDeepLink,
  snapshotShareQuery,
} from "../src/lib/chat-deeplink";
import { rewriteAutostartToResume } from "../src/lib/return-autostart";
import { parseShareQuery } from "../src/lib/share-links";

const FALLBACK_IDS = [
  "twink-default",
  "female-default",
  "twink-shy-boy",
  "twink-gym",
  "twink-alt-punk",
  "female-soft-goth",
  "female-athletic-tease",
  "female-playful-brat",
];

const LIVE_IDS = [...FALLBACK_IDS, "liam", "emma", "jenny"];

function checkParseKeepsAutostartCharacter() {
  const q = parseShareQuery("?character=liam&autostart=1");
  assert.equal(q.characterId, "liam");
  assert.equal(q.autostart, true);
  assert.equal(q.fresh, false);
  assert.equal(q.resumeCode, undefined);
}

function checkEmmaAutostart() {
  const q = snapshotShareQuery("character=emma&autostart=1");
  assert.equal(q.characterId, "emma");
  assert.equal(q.autostart, true);
}

function checkPendingDeepLink() {
  assert.equal(
    hasPendingShareDeepLink(parseShareQuery("?character=liam&autostart=1")),
    true,
  );
  assert.equal(hasPendingShareDeepLink(parseShareQuery("?character=liam")), true);
  assert.equal(hasPendingShareDeepLink(parseShareQuery("?resume=ABC123")), true);
  assert.equal(hasPendingShareDeepLink(parseShareQuery("")), false);
  assert.equal(hasPendingShareDeepLink(parseShareQuery("?autostart=1")), false);
  assert.equal(hasPendingShareDeepLink(null), false);
}

function checkReclaimDoesNotRewriteWithoutHeat() {
  assert.equal(rewriteAutostartToResume("?character=liam&autostart=1"), null);
  assert.equal(rewriteAutostartToResume("?character=emma&autostart=1"), null);
}

function checkWaitUntilCatalogHasPackId() {
  const query = parseShareQuery("?character=liam&autostart=1");
  assert.deepEqual(
    resolveCharacterDeepLink({
      query,
      catalogIds: FALLBACK_IDS,
      catalogReady: false,
    }),
    { action: "wait" },
  );
}

function checkUnknownAfterCatalogReady() {
  const query = parseShareQuery("?character=liam&autostart=1");
  assert.deepEqual(
    resolveCharacterDeepLink({
      query,
      catalogIds: FALLBACK_IDS,
      catalogReady: true,
    }),
    { action: "unknown", characterId: "liam" },
  );
}

function checkSelectAndAutostartWhenLive() {
  const query = parseShareQuery("?character=liam&autostart=1");
  assert.deepEqual(
    resolveCharacterDeepLink({
      query,
      catalogIds: LIVE_IDS,
      catalogReady: true,
    }),
    { action: "select", characterId: "liam", autostart: true, sessionMode: undefined },
  );

  const emma = parseShareQuery("?character=emma&autostart=1");
  assert.deepEqual(
    resolveCharacterDeepLink({
      query: emma,
      catalogIds: LIVE_IDS,
      catalogReady: false,
    }),
    { action: "select", characterId: "emma", autostart: true, sessionMode: undefined },
  );
}

function checkPickerWithoutAutostart() {
  const query = parseShareQuery("?character=liam");
  assert.deepEqual(
    resolveCharacterDeepLink({
      query,
      catalogIds: LIVE_IDS,
      catalogReady: true,
    }),
    { action: "select", characterId: "liam", autostart: false, sessionMode: undefined },
  );
}

function checkEdgePaceAutostart() {
  const query = parseShareQuery("?character=jenny&autostart=1&mode=edge_pace");
  assert.deepEqual(
    resolveCharacterDeepLink({
      query,
      catalogIds: LIVE_IDS,
      catalogReady: true,
    }),
    {
      action: "select",
      characterId: "jenny",
      autostart: true,
      sessionMode: "edge_pace",
    },
  );
}

function checkResumeQueryIsPendingNotCharacterWait() {
  const query = parseShareQuery("?resume=AB12CD&character=liam&rehydrate=1");
  assert.equal(hasPendingShareDeepLink(query), true);
  assert.equal(query.resumeCode, "AB12CD");
  assert.equal(query.characterId, "liam");
  assert.equal(query.rehydrate, true);
  // Character select still resolves; ChatApp applies resume first and marks handled.
  assert.equal(
    resolveCharacterDeepLink({
      query,
      catalogIds: LIVE_IDS,
      catalogReady: true,
    }).action,
    "select",
  );
}

function checkFreshAutostartStillSelects() {
  const query = parseShareQuery("?character=liam&autostart=1&fresh=1");
  assert.equal(query.fresh, true);
  assert.deepEqual(
    resolveCharacterDeepLink({
      query,
      catalogIds: LIVE_IDS,
      catalogReady: true,
    }),
    { action: "select", characterId: "liam", autostart: true, sessionMode: undefined },
  );
}

function checkClobberedTwinkDefaultWouldMisselect() {
  // Documents the production bug: idle URL sync rewrote the bar before consume.
  const clobbered = parseShareQuery("?character=twink-default");
  assert.deepEqual(
    resolveCharacterDeepLink({
      query: clobbered,
      catalogIds: FALLBACK_IDS,
      catalogReady: false,
    }),
    {
      action: "select",
      characterId: "twink-default",
      autostart: false,
      sessionMode: undefined,
    },
  );
  const original = parseShareQuery("?character=liam&autostart=1");
  assert.notEqual(original.characterId, clobbered.characterId);
  assert.equal(original.autostart, true);
  assert.equal(clobbered.autostart, false);
}

const checks = [
  checkParseKeepsAutostartCharacter,
  checkEmmaAutostart,
  checkPendingDeepLink,
  checkReclaimDoesNotRewriteWithoutHeat,
  checkWaitUntilCatalogHasPackId,
  checkUnknownAfterCatalogReady,
  checkSelectAndAutostartWhenLive,
  checkPickerWithoutAutostart,
  checkEdgePaceAutostart,
  checkResumeQueryIsPendingNotCharacterWait,
  checkFreshAutostartStillSelects,
  checkClobberedTwinkDefaultWouldMisselect,
];

for (const fn of checks) fn();
console.log(`ok ${checks.length} chat-deeplink checks`);
