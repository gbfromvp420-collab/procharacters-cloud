/**
 * Unit checks for autostart / character deep-link decisions.
 * Run: npx --yes tsx scripts/check-chat-deeplink.ts
 */
import assert from "node:assert/strict";
import {
  hasPendingShareDeepLink,
  initialPickerCharacterId,
  resolveCharacterDeepLink,
  resolveChatBootIdentity,
  snapshotShareQuery,
} from "../src/lib/chat-deeplink";
import { rewriteAutostartToResume } from "../src/lib/return-autostart";
import { parseShareQuery } from "../src/lib/share-links";
import {
  isGenVideoOptIn,
  isPlayableGenVideoUrl,
  overlayFromPerform,
} from "../src/lib/gen-video";

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

function checkInitialPickerHonorsQuery() {
  assert.equal(initialPickerCharacterId("?character=liam&autostart=1"), "liam");
  assert.equal(initialPickerCharacterId("?character=emma&autostart=1"), "emma");
  assert.equal(initialPickerCharacterId(""), "twink-default");
  assert.equal(initialPickerCharacterId("?autostart=1"), "twink-default");
}

function checkBootLabelIgnoresLeftoverSavedName() {
  const liamBoot = resolveChatBootIdentity({
    queryCharacterId: "liam",
    queryConsumed: false,
    selectedCharacterId: "liam",
    liveCharacterName: null,
    selectedDisplayName: null,
    savedSession: {
      characterId: "emma",
      characterName: "Naughty Syntax Emma",
    },
  });
  assert.equal(liamBoot.intendedCharacterId, "liam");
  assert.equal(liamBoot.displayName, null);
  assert.equal(liamBoot.showMind, true);
  assert.equal(liamBoot.pendingRequested, false);

  const emmaBoot = resolveChatBootIdentity({
    queryCharacterId: "emma",
    queryConsumed: false,
    selectedCharacterId: "emma",
    liveCharacterName: null,
    selectedDisplayName: "Naughty Syntax Emma",
    savedSession: {
      characterId: "liam",
      characterName: "Naughty Syntax Liam",
    },
  });
  assert.equal(emmaBoot.displayName, "Naughty Syntax Emma");
  assert.equal(emmaBoot.showMind, true);
}

function checkBootLabelNeutralWhileDefaultStillSelected() {
  const boot = resolveChatBootIdentity({
    queryCharacterId: "liam",
    queryConsumed: false,
    selectedCharacterId: "twink-default",
    liveCharacterName: null,
    selectedDisplayName: "Twink Default",
    savedSession: {
      characterId: "emma",
      characterName: "Naughty Syntax Emma",
    },
  });
  assert.equal(boot.pendingRequested, true);
  assert.equal(boot.displayName, null);
  assert.equal(boot.showMind, false);
  assert.equal(boot.intendedCharacterId, "liam");
}

function checkBootLabelDoesNotUseSavedNameForDefaultMind() {
  const boot = resolveChatBootIdentity({
    queryCharacterId: "liam",
    queryConsumed: false,
    selectedCharacterId: "twink-default",
    savedSession: {
      characterId: "twink-default",
      characterName: "Twink Default",
    },
  });
  assert.equal(boot.showMind, false);
  assert.equal(boot.displayName, null);
}

function checkBootLabelAfterQueryConsumedAllowsPickerHop() {
  const boot = resolveChatBootIdentity({
    queryCharacterId: "liam",
    queryConsumed: true,
    selectedCharacterId: "emma",
    selectedDisplayName: "Naughty Syntax Emma",
    savedSession: {
      characterId: "liam",
      characterName: "Naughty Syntax Liam",
    },
  });
  assert.equal(boot.pendingRequested, false);
  assert.equal(boot.intendedCharacterId, "emma");
  assert.equal(boot.displayName, "Naughty Syntax Emma");
  assert.equal(boot.showMind, true);
}

function checkBootLabelUsesMatchingSavedName() {
  const boot = resolveChatBootIdentity({
    queryCharacterId: "liam",
    queryConsumed: false,
    selectedCharacterId: "liam",
    savedSession: {
      characterId: "liam",
      characterName: "Naughty Syntax Liam",
    },
  });
  assert.equal(boot.displayName, "Naughty Syntax Liam");
  assert.equal(boot.showMind, true);
}

function checkGenVideoQueryIsOptInNotPending() {
  const q = parseShareQuery("?character=liam&genVideo=1");
  assert.equal(q.genVideo, true);
  assert.equal(q.characterId, "liam");
  assert.equal(isGenVideoOptIn(q), true);
  assert.equal(hasPendingShareDeepLink(parseShareQuery("?genVideo=1")), false);
}

function checkGenVideoOverlayIgnoresMockScheme() {
  assert.equal(isPlayableGenVideoUrl("mock://video/liam/job.mp4"), false);
  assert.equal(isPlayableGenVideoUrl("https://cdn.example/clip.mp4"), true);
  assert.equal(overlayFromPerform({ ok: true, configured: false }).status, "off");
  assert.equal(
    overlayFromPerform({
      ok: true,
      configured: true,
      videoUrl: "mock://video/x/y.mp4",
    }).status,
    "mock",
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
  checkInitialPickerHonorsQuery,
  checkBootLabelIgnoresLeftoverSavedName,
  checkBootLabelNeutralWhileDefaultStillSelected,
  checkBootLabelDoesNotUseSavedNameForDefaultMind,
  checkBootLabelAfterQueryConsumedAllowsPickerHop,
  checkBootLabelUsesMatchingSavedName,
  checkGenVideoQueryIsOptInNotPending,
  checkGenVideoOverlayIgnoresMockScheme,
  checkClobberedTwinkDefaultWouldMisselect,
];

for (const fn of checks) fn();
console.log(`ok ${checks.length} chat-deeplink checks`);
