import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    console.log(`Procharacters backend listening on http://${env.HOST}:${env.PORT}`);
    console.log(`WebSocket endpoint: ws://${env.HOST}:${env.PORT}/ws/sessions/:sessionId?token=...`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
}

void main();