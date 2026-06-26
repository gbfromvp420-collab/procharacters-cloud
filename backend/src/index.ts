import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function main() {
  console.log(
    `[startup] procharacters backend | NODE_ENV=${env.NODE_ENV} | PORT=${env.PORT} | REPO_ROOT=${env.repoRoot}`,
  );

  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`Procharacters backend listening on http://${env.HOST}:${env.PORT}`);
    console.log(`Health: http://${env.HOST}:${env.PORT}/health`);
    console.log(`WebSocket: ws(s)://<public-host>/ws/sessions/:sessionId?token=...`);
  } catch (error) {
    console.error("[startup] Failed to bind server:", error);
    process.exit(1);
  }
}

void main();