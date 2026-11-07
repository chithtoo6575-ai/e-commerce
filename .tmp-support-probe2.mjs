// Probe 2: intercept the app's own support request to see exactly what the
// browser sends and what comes back, then re-render after a successful refetch.
export default async function run(page, ui) {
  const log = {};

  await page.goto("http://localhost:5173/my-online-shop/", {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(() => {
    localStorage.setItem("shop_onboarding_seen", "1");
    localStorage.setItem("hto_guest_mode", "true");
    localStorage.setItem("htoo_admin_support_channels", "[]");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.waitForFunction(
    () => document.querySelectorAll(".desktop-view button").length > 0,
    null,
    { timeout: 30000 },
  );

  // Record every support-channels request/response the app makes.
  await page.evaluate(() => {
    window.__supportCalls = [];
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      const response = await originalFetch(...args);
      if (!url || !url.includes("support-channels")) return response;
      const clone = response.clone();
      const body = await clone.text();
      window.__supportCalls.push({
        url,
        status: response.status,
        type: response.headers.get("content-type"),
        body: body.slice(0, 160),
      });
      return response;
    };
  });
  log.wrapped = await page.evaluate(() => typeof window.fetch);

  await page.evaluate(() => {
    const tab = [...document.querySelectorAll(".desktop-view button")].find(
      (button) => /account/i.test(button.textContent || ""),
    );
    tab?.click();
  });
  await page.waitForTimeout(1500);

  log.calls = await page.evaluate(() => window.__supportCalls);
  log.cardBefore = await page.evaluate(
    () => document.querySelector(".desktop-support-card")?.innerText || null,
  );
  log.visibleSupportRows = await page.evaluate(() =>
    [...document.querySelectorAll(".support-channel")].map((row) => ({
      href: row.getAttribute("href"),
      text: row.innerText,
    })),
  );
  log.localStorageKeys = await page.evaluate(() =>
    Object.keys(localStorage).filter((key) => /support/i.test(key)),
  );
  return log;
}
