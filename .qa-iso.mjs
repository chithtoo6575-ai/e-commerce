const DEBUG_PORT = 9231;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:5173/my-online-shop/";

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const profile = mkdtempSync(join(tmpdir(), "qa-iso-"));
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
  await sleep(4500);
  await evaluate(`(() => {
    [...document.querySelectorAll('.mob-nav-item')].find((b)=>b.textContent.includes('အကောင့်'))?.click()
    return true
  })()`);
  await sleep(900);
  await evaluate(`(() => {
    [...document.querySelectorAll('.mob-menu-item')].find((b)=>b.textContent.includes('ဘာသာစကား'))?.click()
    return true
  })()`);
  await sleep(1000);

  // Build a controlled comparison panel with the exact same string in several styles.
  const info = await evaluate(`(async () => {
    await document.fonts.ready
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:0;top:0;right:0;z-index:99999;background:#fff;padding:10px;font-size:22px'
    const variants = [
      ['title as-is (weight 800)', 'font-weight:800'],
      ['same text weight 400', 'font-weight:400'],
      ['Latin sample', ''],
    ]
    host.innerHTML = ''
    const mk = (label, text, css) => {
      const row = document.createElement('div')
      row.style.cssText = 'padding:4px 0;border-bottom:1px solid #eee;' + css
      row.textContent = label + ': ' + text
      host.appendChild(row)
      return row
    }
    const t = document.querySelector('.mob-sheet-head h3')
    mk('original title node', t.textContent, '')
    mk('fresh same text', 'ဘာသာစကားများ', '')
    mk('fresh Myanmar only', 'မြန်မာ', '')
    mk('My Orders label', 'မှာယူမှုများ', '')
    document.body.appendChild(host)

    // Measure which font each row actually uses via width comparison
    const probe = (text, family) => {
      const el = document.createElement('span')
      el.textContent = text
      el.style.cssText = 'position:absolute;visibility:hidden;font-size:40px;font-family:' + family
      document.body.appendChild(el)
      const w = Math.round(el.getBoundingClientRect().width)
      el.remove()
      return w
    }
    return {
      originalText: t.textContent,
      originalCode: [...t.textContent].map((c)=>c.codePointAt(0).toString(16)).join(' '),
      freshSameText: 'ဘာသာစကားများ',
      notoWidth: probe('ဘာသာစကားများ', '"Noto Sans Myanmar"'),
      sansWidth: probe('ဘာသာစကားများ', 'sans-serif'),
      loaded: [...new Set([...document.fonts].filter((f)=>f.status==='loaded').map((f)=>f.family))],
    }
  })()`);

  const { data } = await send("Page.captureScreenshot", {
    format: "png",
    clip: { x: 0, y: 0, width: 390, height: 260, scale: 2 },
    captureBeyondViewport: false,
  });
  writeFileSync(".qa-iso.png", Buffer.from(data, "base64"));
  console.log(JSON.stringify(info, null, 2));
  ws.close();
  chrome.kill();
  process.exit(0);
}
main().catch((e) => {
  console.error("QA FAILED:", e.message);
  chrome.kill();
  process.exit(1);
});
