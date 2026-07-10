/**
 * Ops smoke: confirm Web Push VAPID endpoint is live.
 * Usage:
 *   npx tsx scripts/smoke-push-vapid.ts
 *   npx tsx scripts/smoke-push-vapid.ts https://procharacters-api-production-0417.up.railway.app
 */
const base = (process.argv[2] || process.env.PUBLIC_API_URL || "http://localhost:3001").replace(
  /\/$/,
  "",
);

async function main() {
  const url = `${base}/api/v1/push/vapid-public-key`;
  console.log(`[smoke-push] GET ${url}`);
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    console.error(`[smoke-push] FAIL HTTP ${res.status}: ${text}`);
    process.exit(1);
  }
  let data: { configured?: boolean; publicKey?: string | null };
  try {
    data = JSON.parse(text) as { configured?: boolean; publicKey?: string | null };
  } catch {
    console.error(`[smoke-push] FAIL bad JSON: ${text}`);
    process.exit(1);
  }
  console.log(`[smoke-push] configured=${data.configured} keyLen=${data.publicKey?.length ?? 0}`);
  if (!data.configured || !data.publicKey) {
    console.error(
      "[smoke-push] FAIL — set VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY on the API service",
    );
    process.exit(1);
  }
  console.log("[smoke-push] OK — Web Push VAPID is configured");
}

void main().catch((error) => {
  console.error("[smoke-push] FAIL", error);
  process.exit(1);
});
