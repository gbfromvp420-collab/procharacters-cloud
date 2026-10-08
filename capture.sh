#!/usr/bin/env bash
# Capture desktop + mobile screenshots of the running preview.
#
# Env: CAPTURE_URL (exact page to open), CAPTURE_DIR (output dir for
#   final-desktop.png + final-mobile.png). Closes its own browser, leaves the
#   app running. Exit 75 = temporary navigation/browser infra failure,
#   exit 1 = script or rendering defect.
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

/usr/bin/time -p test -n "${CAPTURE_URL:?Set CAPTURE_URL to the exact page to capture.}"
/usr/bin/time -p test -n "${CAPTURE_DIR:?Set CAPTURE_DIR to the screenshot output directory.}"
/usr/bin/time -p mkdir -p "$CAPTURE_DIR"

/usr/bin/time -p node -e '
const { mkdirSync, readFileSync } = require("node:fs");
const { join } = require("node:path");
const { createRequire } = require("node:module");

const url = process.env.CAPTURE_URL;
const output = process.env.CAPTURE_DIR;
const runtime = join(process.env.HOME, ".local/share/omgithub-playwright");
const playRequire = createRequire(join(runtime, "package.json"));
const { chromium } = playRequire("playwright");
const config = JSON.parse(readFileSync(join(runtime, process.platform === "darwin" ? "metal.json" : "linux.json"), "utf8"));
if (process.platform === "linux") process.env.DISPLAY ||= ":" + readFileSync(join(runtime, "display"), "utf8").trim();

mkdirSync(output, { recursive: true });
const transient = (error) => { throw Object.assign(error instanceof Error ? error : new Error(String(error)), { exitCode: 75 }); };
const AGE_KEY = "pc_age_verified_21";

(async () => {
  let browser;
  try {
    const t0 = Date.now();
    browser = await chromium.launch({
      ...config.browser.launchOptions,
      args: [...(config.browser.launchOptions.args || []), "--allow-running-insecure-content"],
      timeout: 30000,
    }).catch(transient);
    console.log(`[timing] browser.launch: ${Date.now() - t0} ms`);
    for (const [name, width, height] of [["desktop", 1440, 900], ["mobile", 390, 844]]) {
      const t1 = Date.now();
      const context = await browser.newContext({ viewport: { width, height } }).catch(transient);
      // Dismiss the 21+ interstitial (client attestation) so the product renders.
      await context.addInitScript(`try { localStorage.setItem("${AGE_KEY}", String(Date.now())); } catch {}`);
      const page = await context.newPage().catch(transient);
      page.setDefaultTimeout(30000);
      page.on("pageerror", (error) => console.error(`[pageerror] ${error.message}`));
      const response = await page.goto(url, { waitUntil: "load", timeout: 45000 }).catch(transient);
      const status = response?.status();
      if (!response || !response.ok()) {
        const code = !response || [408, 429, 500, 502, 503, 504].includes(status) ? 75 : 1;
        throw Object.assign(new Error(`HTTP ${status ?? "no-response"} loading preview`), { exitCode: code });
      }
      await page.locator(process.env.CAPTURE_READY_SELECTOR || "body").waitFor({ state: "visible" }).catch((error) => {
        throw Object.assign(error, { exitCode: 1 });
      });
      await page.waitForFunction(() => document.fonts.status === "loaded", null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(1500);
      const textLen = await page.evaluate(() => document.body.innerText.trim().length);
      if (textLen < 100) {
        throw Object.assign(new Error(`rendering defect: body text length ${textLen}`), { exitCode: 1 });
      }
      await page.screenshot({ path: join(output, `final-${name}.png`), timeout: 30000 }).catch((error) => {
        if (error.name === "TimeoutError" || !browser.isConnected()) transient(error);
        throw error;
      });
      console.log(`[timing] capture ${name}: ${Date.now() - t1} ms (body text ${textLen} chars)`);
      await context.close().catch(transient);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = error.exitCode || 1;
  } finally {
    await browser?.close().catch((error) => { console.error(error); process.exitCode ||= 75; });
  }
})();
'
