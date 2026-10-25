// Temporary QA: verify order cards render, are tappable, and open a chat-free detail view.
const DEBUG_PORT = 9223;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL = "http://localhost:5173/my-online-shop/";

import { spawn } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const profile = mkdtempSync(join(tmpdir(), "qa-orders-"));
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

const seededOrders = [
  {
    id: "qa-order-1",
    orderNumber: "HT-QA0001",
    status: "Pending",
    paymentStatus: "Pending",
    paymentMethod: "KBZ Pay",
    deliveryMethod: "Delivery",
    subtotal: 45000,
    discount: 0,
    shippingFee: 3000,
    total: 48000,
    customer: { name: "QA", address: "No.1, Yangon", phone: "09" },
    items: [
      {
        productId: "p1",
        name: "Cotton Shirt",
        quantity: 1,
        price: 45000,
        lineTotal: 45000,
        variants: { size: "M", color: "Blue" },
      },
    ],
    createdAt: new Date().toISOString(),
  },
  {
    id: "qa-order-2",
    orderNumber: "HT-QA0002",
    status: "Processing",
    paymentStatus: "Paid",
    paymentMethod: "KBZ Pay",
    deliveryMethod: "Delivery",
    subtotal: 90000,
    discount: 0,
    shippingFee: 3000,
    total: 93000,
    customer: { name: "QA", address: "No.1, Yangon", phone: "09" },
    items: [
      {
        productId: "p2",
        name: "Linen Dress",
        quantity: 2,
        price: 45000,
        lineTotal: 90000,
        variants: {},
      },
    ],
    createdAt: new Date().toISOString(),
  },
];

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
  const replies = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.method === "Fetch.requestPaused") {
      const { requestId, request } = msg.params;
      if (
        request.url.includes("/api/customer/orders?") ||
        request.url.endsWith("/api/customer/orders")
      ) {
        const body = Buffer.from(
          JSON.stringify({ orders: seededOrders }),
        ).toString("base64");
        replies.push({
          id: ++id,
          method: "Fetch.fulfillRequest",
          params: {
            requestId,
            responseCode: 200,
            responseHeaders: [
              { name: "Content-Type", value: "application/json" },
            ],
            body,
          },
        });
      } else {
        replies.push({
          id: ++id,
          method: "Fetch.continueRequest",
          params: { requestId },
        });
      }
      return;
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

  // Flush interception replies on the next tick, after the socket is fully wired.
  const flush = () => {
    while (replies.length) ws.send(JSON.stringify(replies.shift()));
  };
  setInterval(flush, 20);

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
  await send("Fetch.enable", {
    patterns: [{ urlPattern: "*", requestStage: "Request" }],
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
  await sleep(4500);

  await evaluate(`(() => {
    const account = [...document.querySelectorAll('.mob-nav-item')].find((b) => b.textContent.includes('အကောင့်'))
    if (account) account.click()
    return true
  })()`);
  await sleep(900);

  await evaluate(`(() => {
    const btn = [...document.querySelectorAll('.mob-menu-item')].find((b) => b.textContent.includes('မှာယူမှုများ'))
    if (btn) btn.click()
    return true
  })()`);
  await sleep(1300);
  await shot(".qa-cards.png");

  const cards = await evaluate(`(() => {
    const list = [...document.querySelectorAll('.mob-order-card')]
    return {
      count: list.length,
      tags: [...new Set(list.map((c) => c.tagName))],
      tappable: list.every((c) => c.classList.contains('mob-order-card--tappable')),
      buttonsInside: list.reduce((n, c) => n + c.querySelectorAll('button').length, 0),
      hasDetailsButtonText: document.body.textContent.includes('အသေးစိတ်နှင့် စကားပြောရန်') || document.body.textContent.includes('Details & Chat'),
      firstCardText: list[0] ? list[0].textContent.trim() : null,
    }
  })()`);

  await evaluate(`(() => {
    const card = document.querySelector('.mob-order-card--tappable')
    if (card) card.click()
    return true
  })()`);
  await sleep(1500);
  await shot(".qa-cards-detail.png");

  const detail = await evaluate(`(() => {
    const text = document.body.textContent
    return {
      title: document.querySelector('.mob-sheet-head h3')?.textContent.trim(),
      chatHeading: text.includes('ဆိုင်ပိုင်ရှင်နှင့် စကားပြောရန်') || text.includes('Chat with Shop Owner'),
      chatThread: !!document.querySelector('.mob-chat-thread'),
      chatInput: !!document.querySelector('.mob-chat-input'),
      sendButton: [...document.querySelectorAll('button')].some((b) => b.textContent.trim() === 'ပို့ရန်' || b.textContent.trim() === 'Send'),
      timeline: !!document.querySelector('.mob-order-timeline'),
      itemRows: document.querySelectorAll('.mob-order-detail-items > div').length,
      hasOrderNumber: text.includes('HT-QA0001'),
    }
  })()`);

  console.log(JSON.stringify({ cards, detail }, null, 2));
  ws.close();
  chrome.kill();
  process.exit(0);
}

main().catch((error) => {
  console.error("QA FAILED:", error.message);
  chrome.kill();
  process.exit(1);
});
