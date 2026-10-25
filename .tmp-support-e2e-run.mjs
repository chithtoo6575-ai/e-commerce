// Standalone runner for .tmp-support-e2e.mjs — drives the already-installed
// Playwright Chromium over CDP and provides the small `page`/`ui` surface the
// harness expects (goto/evaluate/waitForFunction/waitForTimeout/screenshot/
// setViewportSize + ui.snapshot()). Start `npm run dev` first.
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
// QA_HARNESS lets the same runner drive other harness files in this folder.
const HARNESS = process.env.QA_HARNESS || ".tmp-support-e2e.mjs";
const { default: run } = await import(`./${HARNESS}`);

const DEBUG_PORT = Number(process.env.QA_DEBUG_PORT || 9331);
const CHROME =
  process.env.CHROME_PATH ||
  join(
    process.env.LOCALAPPDATA,
    "ms-playwright",
    "chromium-1243",
    "chrome-win64",
    "chrome.exe",
  );

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const profile = mkdtempSync(join(tmpdir(), "qa-support-"));

const chrome = spawn(
  CHROME,
  [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${profile}`,
    "--headless=new",
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1280,1100",
    "--hide-scrollbars",
    "about:blank",
  ],
  { stdio: "ignore" },
);

async function main() {
  let target;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const targets = await (
        await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/list`)
      ).json();
      target = targets.find((item) => item.type === "page");
      if (target) break;
    } catch {
      /* still starting */
    }
    await sleep(250);
  }
  if (!target) throw new Error("Chromium did not expose a page target.");

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.onopen = resolve;
    socket.onerror = reject;
  });

  let callId = 0;
  const pending = new Map();
  const consoleErrors = [];
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.method === "Runtime.exceptionThrown") {
      consoleErrors.push(
        message.params.exceptionDetails?.exception?.description || "exception",
      );
    }
    if (
      message.method === "Runtime.consoleAPICalled" &&
      message.params.type === "error"
    ) {
      consoleErrors.push(
        message.params.args
          .map((arg) => arg.value || arg.description)
          .join(" "),
      );
    }
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
    }
  };

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      callId += 1;
      pending.set(callId, { resolve, reject });
      socket.send(JSON.stringify({ id: callId, method, params }));
    });

  // Playwright calls `evaluate(fn)` with no second argument. Only forward a value
  // when the caller actually passed one; forwarding `null` would override the
  // function's own default parameter (e.g. `options = {}`).
  const evaluate = async (expression, arg) => {
    const hasArg = arguments.length > 1;
    const result = await send("Runtime.evaluate", {
      expression:
        typeof expression === "function"
          ? `(${expression.toString()})(${hasArg ? JSON.stringify(arg) : ""})`
          : expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ||
          JSON.stringify(result.exceptionDetails),
      );
    }
    return result.result.value;
  };

  // Poll document.readyState until it reaches the requested lifecycle stage.
  const waitForReadyState = async (waitUntil = "load") => {
    const readyStateExpression =
      waitUntil === "domcontentloaded"
        ? "document.readyState === 'interactive' || document.readyState === 'complete'"
        : "document.readyState === 'complete'";
    for (let attempt = 0; attempt < 120; attempt += 1) {
      await sleep(100);
      try {
        if (await evaluate(readyStateExpression)) return;
      } catch {
        /* navigating */
      }
    }
  };

  const page = {
    async goto(url, options = {}) {
      await send("Page.navigate", { url });
      await waitForReadyState(options.waitUntil);
      return null;
    },
    // The harness passes `{ waitUntil: 'domcontentloaded' }`; the old signature
    // took no options at all, so the reload returned before the app had mounted
    // and every following query ran against the previous document.
    async reload(options = {}) {
      await send("Page.reload", { ignoreCache: true });
      await waitForReadyState(options.waitUntil);
      return null;
    },
    evaluate,
    waitForTimeout: (ms) => sleep(ms),
    async setViewportSize({ width, height }) {
      await send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
    },
    async waitForFunction(fn, _arg, { timeout = 30000 } = {}) {
      const deadline = Date.now() + timeout;
      while (Date.now() < deadline) {
        try {
          if (await evaluate(fn)) return true;
        } catch {
          /* navigation in flight */
        }
        await sleep(150);
      }
      throw new Error(`waitForFunction timed out: ${fn}`);
    },
    async screenshot({ path }) {
      const { data } = await send("Page.captureScreenshot", {
        format: "png",
        captureBeyondViewport: false,
      });
      writeFileSync(path, Buffer.from(data, "base64"));
    },
  };

  // Accessibility-style snapshot: an indented outline of the visible DOM.
  const ui = {
    async snapshot() {
      return evaluate(() => {
        const lines = [];
        const skip = new Set(["SCRIPT", "STYLE", "NOSCRIPT"]);
        const walk = (node, depth) => {
          if (depth > 12) return;
          const tag = node.tagName.toLowerCase();
          if (skip.has(node.tagName)) return;
          const role = node.getAttribute("role");
          const name =
            node.getAttribute("aria-label") ||
            (node.children.length === 0 ? (node.textContent || "").trim() : "");
          const bits = [tag];
          if (role) bits.push(`role=${role}`);
          if (node.id) bits.push(`#${node.id}`);
          if (node.className && typeof node.className === "string") {
            bits.push(`.${node.className.trim().split(/\s+/).join(".")}`);
          }
          if (name) bits.push(`"${name.slice(0, 80)}"`);
          lines.push(`${"  ".repeat(depth)}${bits.join(" ")}`);
          for (const child of node.children) walk(child, depth + 1);
        };
        walk(document.body, 0);
        return lines.join("\n");
      });
    },
  };

  await send("Page.enable");
  await send("Runtime.enable");

  try {
    const log = await run(page, ui);
    log.consoleErrors = consoleErrors;
    writeFileSync(".tmp-support-e2e.json", JSON.stringify(log, null, 2), "utf8");
    console.log(readFileSync(".tmp-support-e2e.json", "utf8"));
  } catch (error) {
    // Keep the log the harness built before it failed, plus a final DOM outline,
    // so a mid-run failure can be diagnosed instead of only reported.
    const failed = {
      ...error.log,
      failure: String(error),
      consoleErrors,
    };
    try {
      failed.finalSnap = await ui.snapshot();
      failed.finalUrl = await evaluate("location.href");
      failed.finalTitle = await evaluate("document.title");
      failed.bodyText = (await evaluate("document.body.innerText")).slice(0, 3000);
      await page.screenshot({ path: ".tmp-support-failure.png" });
    } catch {
      /* page unavailable */
    }
    writeFileSync(
      `.tmp-support-${HARNESS.replace(/\.mjs$/, "")}-out.json`,
      JSON.stringify(failed, null, 2),
      "utf8",
    );
    throw error;
  }
}

main()
  .catch((error) => {
    console.error("FAILED:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    try {
      chrome.kill();
    } catch {
      /* already gone */
    }
  });
