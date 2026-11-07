// Temporary QA: measure Burmese label clipping in the language sheet.
const DEBUG_PORT = 9227;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:5173/my-online-shop/";

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const profile = mkdtempSync(join(tmpdir(), "qa-mix-"));
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
      /* not up */
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
  const shot = async (f) => {
    const { data } = await send("Page.captureScreenshot", { format: "png" });
    writeFileSync(f, Buffer.from(data, "base64"));
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
      /* nav */
    }
  }
  await evaluate(`(() => {
    localStorage.setItem('hto_guest_mode','true')
    localStorage.setItem('hto_onboarding_done','1')
    localStorage.setItem('hto_customer_language','my')
    return true
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await sleep(4000);

  await evaluate(`(() => {
    [...document.querySelectorAll('.mob-nav-item')].find((b)=>b.textContent.includes('အကောင့်'))?.click()
    return true
  })()`);
  await sleep(800);
  await evaluate(`(() => {
    [...document.querySelectorAll('.mob-menu-item')].find((b)=>b.textContent.includes('ဘာသာစကား'))?.click()
    return true
  })()`);
  await sleep(900);

  const metrics = await evaluate(`(() => {
    const title = document.querySelector('.mob-sheet-head h3')
    const myOpt = [...document.querySelectorAll('.mob-language-option')][1]
    const myTitle = myOpt?.querySelector('.mob-radio-title')
    const myInfo = myOpt?.querySelector('.mob-radio-info')
    const sheet = document.querySelector('.mob-sheet')
    const scroll = sheet?.querySelector('.mob-sheet-scroll')
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        text: el.textContent.trim(),
        left: Math.round(r.left), right: Math.round(r.right), width: Math.round(r.width),
        scrollWidth: el.scrollWidth,
        overflowX: cs.overflowX,
        letterSpacing: cs.letterSpacing,
        fontFamily: cs.fontFamily,
        paddingLeft: cs.paddingLeft,
      }
    }
    return {
      viewport: window.innerWidth,
      title: box(title),
      sheet: box(sheet),
      scroll: box(scroll),
      myTitle: box(myTitle),
      myInfo: box(myInfo),
      fonts: [...document.fonts].map((f) => f.family + ' ' + f.status).slice(0, 12),
    }
  })()`);

  await shot(".qa-clip-check.png");
  console.log(JSON.stringify(metrics, null, 2));
  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch((e) => {
  console.error("QA FAILED:", e.message);
  chrome.kill();
  process.exit(1);
});
