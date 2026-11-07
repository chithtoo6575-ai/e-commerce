// Check whether the Burmese webfont actually downloaded (vs. failing silently).
const DEBUG_PORT = 9232;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:5173/my-online-shop/";

import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const profile = mkdtempSync(join(tmpdir(), "qa-net-"));
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
      /* up */
    }
    await sleep(250);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  const netLog = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.method === "Network.responseReceived") {
      const { url, status, mimeType } = m.params.response;
      if (/fonts\.(googleapis|gstatic)\.com/.test(url) || /\.woff/.test(url)) {
        netLog.push({ status, mimeType, url: url.slice(0, 140) });
      }
    }
    if (m.method === "Network.loadingFailed") {
      netLog.push({
        failed: true,
        error: m.params.errorText,
        type: m.params.type,
      });
    }
    if (m.id && pending.has(m.id)) {
      const { resolve, reject } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) reject(new Error(JSON.stringify(m.error)));
      else resolve(m.result);
    }
  };
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      id += 1;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Page.navigate", { url: URL });
  for (let i = 0; i < 60; i += 1) {
    await sleep(500);
    try {
      if (
        await evaluate("location.origin.startsWith('http') && !!document.body")
      )
        break;
    } catch {
      /* nav */
    }
  }
  await evaluate(`(() => {
    localStorage.setItem('hto_guest_mode','true')
    localStorage.setItem('hto_customer_language','my')
    localStorage.setItem('hto_onboarding_done','1')
    return true
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await sleep(6000);

  const fonts = await evaluate(`(async () => {
    await document.fonts.ready
    return [...document.fonts].map((f) => ({ family: f.family, status: f.status, weight: f.weight }))
  })()`);

  console.log(JSON.stringify({ net: netLog.slice(0, 25), fonts }, null, 2));
  ws.close();
  chrome.kill();
  process.exit(0);
}
main().catch((e) => {
  console.error("QA FAILED:", e.message);
  chrome.kill();
  process.exit(1);
});
