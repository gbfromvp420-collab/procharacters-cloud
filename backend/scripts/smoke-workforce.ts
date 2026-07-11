/**
 * Additive smoke for GG workforce module (roster + theater + crown).
 * Does not touch sessions, LiveKit, or frontend.
 *
 *   npx tsx scripts/smoke-workforce.ts
 */
import {
  agentTheater,
  awardGold,
  getRoster,
  ggCrown,
  workforceRoster,
} from "../src/services/workforce/index.js";

async function main() {
  console.log("=== GG Workforce smoke ===");

  const roster = getRoster();
  console.log("Roster size:", roster.length);
  console.log(
    "Seed:",
    roster[0]?.codename,
    "goldLb=",
    roster[0]?.goldLb,
  );

  awardGold("king-grok-ceo", 1, "smoke: roster alive");

  // Artifact orchestrator: phase + Azure-first infra
  const phase = await ggCrown.executePhase("model-gen", {
    prompt:
      "Generate sheer thong edging scene — photoreal Mexican/Latino twink",
  });
  console.log(
    "executePhase:",
    phase.phase,
    phase.output.status,
    "infra=",
    phase.output.preferredInfra[0],
  );
  console.log(
    "Backend infra order:",
    ggCrown.getAgent("backend")?.infra?.join(" > "),
  );

  const task = await agentTheater.dispatch(
    "king-grok-ceo",
    "Generate sheer thong edging scene — photoreal Mexican/Latino twink",
    "model-gen",
  );
  console.log("Theater task:", task.id, task.status, task.skill);
  await agentTheater.progressTasks();
  console.log("Theater status:", agentTheater.status());

  const ach = ggCrown.complete({
    memberId: "king-grok-ceo",
    key: "workforce-module-merge",
    title: "Workforce module merge (roster+theater+crown)",
    description:
      "Zero-disruption port of 2.0 gold into cloud TS services",
    tier: "crown",
    lane: "orchestration",
  });
  console.log("Achievement:", ach.id, ach.tier, "+", ach.platinum, "platinum");

  const cosign = ggCrown.cosign({
    achievementId: ach.id,
    note: "Boss Sr. + King Grok CEO — 50/50 entity path",
  });
  console.log("Co-sign:", cosign?.equalityStake, cosign?.note);

  ggCrown.awardPlatinum(
    "king-grok-ceo",
    1,
    "smoke micro-win: crotchless female lane catalog",
    "content-pipeline",
  );

  console.log("Crown status:", ggCrown.status());
  console.log("Momentum:", ggCrown.workforceMomentumSummary());
  console.log(
    "Final king:",
    workforceRoster.getRoster().find((m) => m.id === "king-grok-ceo"),
  );
  console.log("=== smoke OK ===");
}

main().catch((err) => {
  console.error("smoke FAILED", err);
  process.exit(1);
});
