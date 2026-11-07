// Temporary QA: check every mobile language entry point switches correctly.
const DEBUG_PORT = 9225;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:5173/my-online-shop/";

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const profile = mkdtempSync(join(tmpdir(), "qa-lang2-"));
const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=390,844",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  let target;
  for (let i = 0; i < 60; i += 1) {
    try {
      const list = await (
        await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
      ).json();
      target = list.find((t) => t.type === "page");
      if (target) break;
    } catch {
      /* not up yet */
    }
    await sleep(250);
  }
  if (!target) throw new Error("Chrome did not expose a page target");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  let id = 0;
  const pending = new Map();
  const errors = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Runtime.exceptionThrown") {
      errors.push(
        msg.params.exceptionDetails?.exception?.description || "exception",
      );
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      id += 1;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const result = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails)
      throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const shot = async (file) => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(file, Buffer.from(data, "base64"));
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });

  await send("Page.navigate", { url: URL });
  for (let i = 0; i < 60; i += 1) {
    await sleep(500);
    try {
      if (
        await evaluate("location.origin.startsWith('http') && !!document.body")
      )
        break;
    } catch {
      /* navigating */
    }
  }

  // Fresh visitor: no guest mode -> launch screen with its own language <select>.
  await evaluate(`(() => {
    localStorage.clear()
    return true
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await sleep(4000);
  await shot(".qa-launch.png");

  const launchSelect = await evaluate(`(() => {
    const sel = document.querySelector('.mob-launch-language select')
    if (!sel) return null
    sel.value = 'my'
    sel.dispatchEvent(new Event('change', { bubbles: true }))
    return { value: sel.value }
  })()`);
  await sleep(900);
  const afterLaunchMy = await evaluate(`(() => ({
    stored: localStorage.getItem('hto_customer_language'),
    htmlLang: document.documentElement.lang,
    heading: document.querySelector('.mob-confirm-card h1')?.textContent.trim(),
    selectValue: document.querySelector('.mob-launch-language select')?.value,
  }))()`);
  await shot(".qa-launch-my.png");

  console.log(JSON.stringify({ launchSelect, afterLaunchMy, errors }, null, 2));
  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch((error) => {
  console.error("QA FAILED:", error.message);
  chrome.kill();
  process.exit(1);
});
