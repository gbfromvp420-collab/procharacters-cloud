import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function main() {
  console.log(
    `[startup] procharacters backend | NODE_ENV=${env.NODE_ENV} | PORT=${env.PORT} | REPO_ROOT=${env.repoRoot}`,
  );

  const app = await buildApp();

  const port = Number(process.env.PORT ?? env.PORT);
  const host = env.HOST;

  try {
    await app.listen({ port, host });
    console.log(`Procharacters backend listening on http://${host}:${port}`);
    console.log(`Health: http://${host}:${port}/health`);
    console.log(`WebSocket: ws(s)://<public-host>/ws/sessions/:sessionId?token=...`);
  } catch (error) {
    console.error("[startup] Failed to bind server:", error);
    process.exit(1);
  }
}

void main();