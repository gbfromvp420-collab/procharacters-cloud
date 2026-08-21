/**
 * Verify LiveKit Cloud credentials in backend/.env
 *
 * Usage: npm run test:livekit
 */

import { config as loadDotenv } from "dotenv";
import { env } from "../src/config/env.js";
import { LiveKitService } from "../src/lib/livekit/service.js";

loadDotenv();

async function main(): Promise<void> {
  console.log("\n── LiveKit verification ──\n");

  if (!env.livekitConfigured) {
    console.error("Missing LiveKit env vars. Add to backend/.env:\n");
    console.error("  LIVEKIT_URL=wss://your-project.livekit.cloud");
    console.error("  LIVEKIT_API_KEY=APIxxxxxxxx");
    console.error("  LIVEKIT_API_SECRET=your_secret");
    console.error("\nGet keys: https://cloud.livekit.io → Project → Settings → Keys\n");
    process.exit(1);
  }

  const livekit = new LiveKitService({
    url: env.LIVEKIT_URL!,
    apiKey: env.LIVEKIT_API_KEY!,
    apiSecret: env.LIVEKIT_API_SECRET!,
  });

  console.log("Client URL:", livekit.serverUrl);
  console.log("Testing API connection…");

  const result = await livekit.verifyConnection();

  if (!result.ok) {
    console.error("\n✗ LiveKit verification failed:", result.error);
    console.error("\nCheck that LIVEKIT_URL, LIVEKIT_API_KEY, and LIVEKIT_API_SECRET match");
    console.error("your LiveKit Cloud project (Settings → Keys).\n");
    process.exit(1);
  }

  console.log("\n✓ LiveKit connected — room create, metadata update, and delete succeeded.");
  console.log("Restart backend (npm run dev) and start a chat session.");
  console.log("Frontend footer should show: LiveKit: room synced\n");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
