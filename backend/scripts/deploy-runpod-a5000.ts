/**
 * RunPod A5000 deploy CLI — wires crown runpod-manager action.
 *
 * Stub (default):
 *   npx tsx scripts/deploy-runpod-a5000.ts
 *   npx tsx scripts/deploy-runpod-a5000.ts --reason "azure-queue-retry" --retry 1
 *
 * Live next Weds (pod hot):
 *   RUNPOD_LIVE=true RUNPOD_API_KEY=... RUNPOD_POD_ID=... npx tsx scripts/deploy-runpod-a5000.ts
 *
 * Env:
 *   RUNPOD_LIVE=true|false
 *   RUNPOD_API_KEY=
 *   RUNPOD_POD_ID=
 *   RUNPOD_API_URL=   (optional, default https://api.runpod.io/graphql)
 */
import {
  deployRunPodWorkers,
  runPodLiveReady,
} from "../src/services/workforce/runpod-deploy.js";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  if (i < 0 || i + 1 >= process.argv.length) return undefined;
  return process.argv[i + 1];
}

function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function main() {
  const reason = arg("--reason") ?? "cli-deploy";
  const retryRaw = arg("--retry");
  const retryParsed = retryRaw !== undefined ? Number(retryRaw) : undefined;
  const retryCount =
    retryParsed !== undefined && Number.isFinite(retryParsed)
      ? retryParsed
      : undefined;
  if (retryRaw !== undefined && retryCount === undefined) {
    console.error(`[GG RunPod][error] invalid --retry value: ${retryRaw}`);
    process.exit(2);
  }
  const forceLive = hasFlag("--force-live");
  const timeoutRaw = arg("--timeout");
  const timeoutMs =
    timeoutRaw !== undefined && Number.isFinite(Number(timeoutRaw))
      ? Number(timeoutRaw)
      : undefined;

  console.log("=== GG RunPod A5000 deploy ===");
  const ready = runPodLiveReady();
  console.log("liveReady:", ready);
  if (!ready.ready) {
    console.log("checklist:", ready.checklist.join(" · "));
  }

  const result = await deployRunPodWorkers({
    reason,
    retryCount,
    forceLive,
    timeoutMs,
  });

  console.log(
    `[GG RunPod] result requestId=${result.requestId} ok=${result.ok} mode=${result.mode} durationMs=${result.durationMs}`,
  );
  if (result.errorCode) {
    console.error(
      `[GG RunPod] errorCode=${result.errorCode} error=${result.error}`,
    );
  }
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
  console.log("=== deploy done ===");
}

main().catch((err) => {
  const msg = err instanceof Error ? err.stack ?? err.message : String(err);
  console.error("[GG RunPod][error] deploy FAILED", msg);
  process.exit(1);
});
