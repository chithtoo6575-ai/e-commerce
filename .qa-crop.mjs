const DEBUG_PORT = 9230;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:5173/my-online-shop/";

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const profile = mkdtempSync(join(tmpdir(), "qa-crop-"));
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
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 3,
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
  await sleep(5000);
  await evaluate(`(() => {
    [...document.querySelectorAll('.mob-nav-item')].find((b)=>b.textContent.includes('အကောင့်'))?.click()
    return true
  })()`);
  await sleep(900);
  await evaluate(`(() => {
    [...document.querySelectorAll('.mob-menu-item')].find((b)=>b.textContent.includes('ဘာသာစကား'))?.click()
    return true
  })()`);
  await sleep(1200);

  const rect = await evaluate(`(() => {
    const head = document.querySelector('.mob-sheet-head')
    const opts = document.querySelector('.mob-language-options')
    const h = head.getBoundingClientRect()
    const o = opts.getBoundingClientRect()
    return { x: 0, y: Math.max(0, h.top - 8), width: 390, height: Math.ceil(o.bottom - h.top + 24) }
  })()`);

  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    clip: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      scale: 3,
    },
    captureBeyondViewport: true,
  });
  writeFileSync(".qa-crop.png", Buffer.from(data, "base64"));

  const textInfo = await evaluate(`(() => {
    const t = document.querySelector('.mob-sheet-head h3')
    const opt = [...document.querySelectorAll('.mob-language-option .mob-radio-title')]
    const cs = getComputedStyle(t)
    return {
      titleText: t.textContent,
      titleCode: [...t.textContent].map((c)=>c.codePointAt(0).toString(16)).join(' '),
      optionTexts: opt.map((o) => o.textContent),
      fontFamily: cs.fontFamily,
      fontWeight: cs.fontWeight,
      loaded: [...document.fonts].filter((f)=>f.status==='loaded').map((f)=>f.family),
    }
  })()`);

  console.log(JSON.stringify({ rect, textInfo }, null, 2));
  ws.close();
  chrome.kill();
  process.exit(0);
}
main().catch((e) => {
  console.error("QA FAILED:", e.message);
  chrome.kill();
  process.exit(1);
});
