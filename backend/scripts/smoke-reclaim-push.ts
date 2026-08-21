/**
 * Send-test reclaim payload checks.
 * Run: npx --yes tsx scripts/smoke-reclaim-push.ts
 */
import assert from "node:assert/strict";
import {
  buildReclaimChatUrl,
  buildTestPushPayload,
  isDnaPowerSession,
  pickTestReclaimSession,
} from "../src/lib/push/reclaim-push.js";

const BASE = "https://procharacters-web-production-7288.up.railway.app";

function checkEmptyFallsBackToAccount() {
  const payload = buildTestPushPayload([], BASE);
  assert.equal(payload.url, `${BASE}/account`);
  assert.equal(payload.dnaPower, false);
  assert.match(payload.body, /Account/i);
}

function checkDnaWinsOverNewerNormal() {
  const picked = pickTestReclaimSession([
    {
      characterId: "emma",
      characterName: "Emma",
      resumeCode: "NEWNEW",
      updatedAt: "2026-08-21T18:00:00.000Z",
      sessionMode: "normal",
      messageCount: 2,
    },
    {
      characterId: "jenny",
      characterName: "Jenny",
      resumeCode: "AB12CD",
      updatedAt: "2026-08-21T12:00:00.000Z",
      sessionMode: "edge_pace",
      dnaTreeNodeId: "edge-hold",
      messageCount: 9,
    },
  ]);
  assert.equal(picked?.characterId, "jenny");
  assert.equal(isDnaPowerSession(picked!), true);
}

function checkTestPayloadDeepLinksEdge() {
  const payload = buildTestPushPayload(
    [
      {
        characterId: "jenny",
        characterName: "Jenny",
        resumeCode: "ab12cd",
        updatedAt: "2026-08-21T12:00:00.000Z",
        sessionMode: "edge_pace",
        dnaTreeNodeId: "edge-hold",
        messageCount: 9,
      },
    ],
    BASE,
  );
  assert.equal(payload.dnaPower, true);
  assert.equal(payload.characterName, "Jenny");
  assert.match(payload.title, /DNA power/i);
  assert.match(payload.body, /Jenny/);
  assert.match(payload.url, /\/chat\?/);
  assert.match(payload.url, /resume=AB12CD/);
  assert.match(payload.url, /character=jenny/);
  assert.match(payload.url, /rehydrate=1/);
  assert.match(payload.url, /mode=edge_pace/);
}

function checkNormalContinueStillReclaims() {
  const payload = buildTestPushPayload(
    [
      {
        characterId: "liam",
        characterName: "Liam",
        resumeCode: "LIAM01",
        updatedAt: "2026-08-21T12:00:00.000Z",
        sessionMode: "normal",
        messageCount: 3,
      },
    ],
    BASE,
  );
  assert.equal(payload.dnaPower, false);
  assert.match(payload.title, /Continue · Liam/);
  assert.match(payload.url, /character=liam/);
  assert.doesNotMatch(payload.url, /mode=edge_pace/);
}

function checkUrlHelper() {
  const url = buildReclaimChatUrl(BASE, { resumeCode: "zz99", characterId: "diego" }, true);
  assert.equal(
    url,
    `${BASE}/chat?resume=ZZ99&rehydrate=1&character=diego&mode=edge_pace`,
  );
}

const checks = [
  checkEmptyFallsBackToAccount,
  checkDnaWinsOverNewerNormal,
  checkTestPayloadDeepLinksEdge,
  checkNormalContinueStillReclaims,
  checkUrlHelper,
];

for (const fn of checks) fn();
console.log(`ok ${checks.length} reclaim-push checks`);
