const DEBUG_PORT = 9229;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:5173/my-online-shop/";

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const profile = mkdtempSync(join(tmpdir(), "qa-final-"));
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
  await sleep(5000);

  await evaluate(`(() => {
    [...document.querySelectorAll('.mob-nav-item')].find((b)=>b.textContent.includes('အကောင့်'))?.click()
    return true
  })()`);
  await sleep(900);

  const fontInfo = await evaluate(`(async () => {
    await document.fonts.ready
    const loaded = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => f.family)
    const probe = (text, css) => {
      const el = document.createElement('span')
      el.textContent = text
      el.style.cssText = 'position:absolute;visibility:hidden;font-size:40px;' + css
      document.body.appendChild(el)
      const w = el.getBoundingClientRect().width
      el.remove()
      return Math.round(w)
    }
    const shell = document.querySelector('.mobile-shell')
    return {
      loadedFonts: [...new Set(loaded)],
      shellFont: shell ? getComputedStyle(shell).fontFamily : null,
      htmlLang: document.documentElement.lang,
      notoSansMyanmar: probe('မြန်မာ', 'font-family:"Noto Sans Myanmar"'),
      sansFallback: probe('မြန်မာ', 'font-family:sans-serif'),
    }
  })()`);

  await evaluate(`(() => {
    [...document.querySelectorAll('.mob-menu-item')].find((b)=>b.textContent.includes('ဘာသာစကား'))?.click()
    return true
  })()`);
  await sleep(1000);
  await shot(".qa-final-my.png");

  const flags = await evaluate(`(() => {
    return [...document.querySelectorAll('.mob-language-option')].map((l) => ({
      label: l.querySelector('.mob-radio-title')?.textContent.trim(),
      hasFlag: !!l.querySelector('.mob-language-flag svg'),
      flagSize: l.querySelector('.mob-language-flag svg') ? (() => {
        const r = l.querySelector('.mob-language-flag svg').getBoundingClientRect()
        return Math.round(r.width) + 'x' + Math.round(r.height)
      })() : null,
    }))
  })()`);

  await evaluate(`(() => {
    const en = [...document.querySelectorAll('.mob-language-option')].find((l)=>l.textContent.includes('English'))
    en?.click()
    return true
  })()`);
  await sleep(1000);
  await shot(".qa-final-en.png");
  const after = await evaluate(`(() => ({
    stored: localStorage.getItem('hto_customer_language'),
    htmlLang: document.documentElement.lang,
    title: document.querySelector('.mob-sheet-head h3')?.textContent.trim(),
  }))()`);

  console.log(JSON.stringify({ fontInfo, flags, after }, null, 2));
  ws.close();
  chrome.kill();
  process.exit(0);
}
main().catch((e) => {
  console.error("QA FAILED:", e.message);
  chrome.kill();
  process.exit(1);
});
