const DEBUG_PORT = 9228;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:5173/my-online-shop/";

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const profile = mkdtempSync(join(tmpdir(), "qa-cv-"));
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
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
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
  await sleep(2500);

  const report = await evaluate(`(() => {
    const probe = (text, css) => {
      const el = document.createElement('span')
      el.textContent = text
      el.style.cssText = 'position:absolute;visibility:hidden;font-size:40px;' + css
      document.body.appendChild(el)
      const w = el.getBoundingClientRect().width
      el.remove()
      return Math.round(w)
    }
    const sample = 'မြန်မာ'
    const base = 'font-size:40px'
    const st = getComputedStyle(document.documentElement)
    return {
      // Compare the requested stack vs a generic fallback: equal widths => Pyidaungsu is missing.
      withStack: probe(sample, base + ';font-family:Pyidaungsu, Manrope, sans-serif'),
      withSans: probe(sample, base + ';font-family:sans-serif'),
      withPyidaungsu: probe(sample, base + ';font-family:Pyidaungsu'),
      manrope: probe(sample, base + ';font-family:Manrope'),
      bodyFont: st.fontFamily,
      appCss: [...document.styleSheets].length,
      langAttr: document.documentElement.lang,
      dir: getComputedStyle(document.body).direction,
    }
  })()`);
  console.log(JSON.stringify(report, null, 2));
  ws.close();
  chrome.kill();
  process.exit(0);
}
main().catch((e) => {
  console.error("QA FAILED:", e.message);
  chrome.kill();
  process.exit(1);
});
