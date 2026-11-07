// Temporary QA: exercise Burmese <-> English switching via the Language sheet.
const DEBUG_PORT = 9224;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:5173/my-online-shop/";

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const profile = mkdtempSync(join(tmpdir(), "qa-lang-"));
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
  const consoleErrors = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === "Runtime.exceptionThrown") {
      consoleErrors.push(
        msg.params.exceptionDetails?.exception?.description || "exception",
      );
    }
    if (
      msg.method === "Runtime.consoleAPICalled" &&
      msg.params.type === "error"
    ) {
      consoleErrors.push(
        msg.params.args.map((a) => a.value || a.description).join(" "),
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

  await evaluate(`(() => {
    localStorage.setItem('hto_guest_mode', 'true')
    localStorage.setItem('hto_onboarding_done', '1')
    localStorage.setItem('hto_customer_language', 'my')
    return true
  })()`);
  await send("Page.reload", { ignoreCache: true });
  await sleep(4000);

  const openLanguageSheet = async () => {
    await evaluate(`(() => {
      const nav = [...document.querySelectorAll('.mob-nav-item')]
      const account = nav.find((b) => b.textContent.includes('အကောင့်') || b.textContent.includes('Account'))
      if (account) account.click()
      return true
    })()`);
    await sleep(800);
    await evaluate(`(() => {
      const item = [...document.querySelectorAll('.mob-menu-item')]
        .find((b) => b.textContent.includes('ဘာသာစကား') || b.textContent.includes('Language'))
      if (item) item.click()
      return true
    })()`);
    await sleep(800);
  };

  const state = () =>
    evaluate(`(() => {
    const active = document.querySelector('input[name="mob-app-language"]:checked')
    const titles = [...document.querySelectorAll('.mob-language-option .mob-radio-title')].map((n) => n.textContent.trim())
    return {
      stored: localStorage.getItem('hto_customer_language'),
      htmlLang: document.documentElement.lang,
      sheetTitle: document.querySelector('.mob-sheet-head h3')?.textContent.trim(),
      checkedRadio: active ? active.value : null,
      optionTitles: titles,
      firstMenuLabel: document.querySelector('.mob-menu-label')?.textContent.trim(),
    }
  })()`);

  const clickOption = async (value) => {
    await evaluate(`(() => {
      const radio = document.querySelector('input[name="mob-app-language"][value="${value}"]')
      if (!radio) return 'missing'
      radio.click()
      return 'clicked'
    })()`);
    await sleep(900);
  };

  const results = {};

  await openLanguageSheet();
  await shot(".qa-lang-1-initial-my.png");
  results.initial = await state();

  // my -> en
  await clickOption("en");
  await shot(".qa-lang-2-after-en.png");
  results.afterEnglish = await state();

  // en -> my (the return switch)
  await clickOption("my");
  await shot(".qa-lang-3-after-my.png");
  results.afterBackToBurmese = await state();

  // Direct label clicks (what a real tap does)
  await evaluate(`(() => {
    const labels = [...document.querySelectorAll('.mob-language-option')]
    const en = labels.find((l) => l.textContent.includes('English'))
    if (en) en.click()
    return true
  })()`);
  await sleep(900);
  results.afterLabelClickEnglish = await state();
  await shot(".qa-lang-4-label-en.png");

  results.consoleErrors = consoleErrors;
  console.log(JSON.stringify(results, null, 2));
  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch((error) => {
  console.error("QA FAILED:", error.message);
  chrome.kill();
  process.exit(1);
});
