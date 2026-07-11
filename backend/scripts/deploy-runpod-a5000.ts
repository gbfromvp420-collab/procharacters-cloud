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
  const retryCount = retryRaw ? Number(retryRaw) : undefined;
  const forceLive = hasFlag("--force-live");

  console.log("=== GG RunPod A5000 deploy ===");
  console.log("liveReady:", runPodLiveReady());

  const result = await deployRunPodWorkers({
    reason,
    retryCount: Number.isFinite(retryCount) ? retryCount : undefined,
    forceLive,
  });

  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exit(1);
  console.log("=== deploy done ===");
}

main().catch((err) => {
  console.error("deploy FAILED", err);
  process.exit(1);
});
