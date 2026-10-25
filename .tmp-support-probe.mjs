// Probe: does the storefront receive the public channel payload, and what does
// the app do with it? Screenshots the Help & Support card for a visual check.
export default async function run(page, ui) {
  const log = {};
  const apiUrl = "http://localhost:5173/api/support-channels";

  await page.goto("http://localhost:5173/my-online-shop/", {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(() => {
    localStorage.setItem("shop_onboarding_seen", "1");
    localStorage.setItem("hto_guest_mode", "true");
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.setViewportSize({ width: 1280, height: 1100 });
  await page.waitForFunction(
    () => document.querySelectorAll(".desktop-view button").length > 0,
    null,
    { timeout: 30000 },
  );

  // Fetch exactly like the app does, from inside the page.
  log.inPageFetch = await page.evaluate(async (url) => {
    try {
      const response = await fetch(url);
      return { status: response.status, body: await response.text() };
    } catch (error) {
      return { error: String(error) };
    }
  }, apiUrl);

  log.storedChannels = await page.evaluate(() => {
    const raw = localStorage.getItem("htoo_admin_support_channels");
    return { raw, parsed: raw ? JSON.parse(raw) : null };
  });

  await page.evaluate(() => {
    const tab = [...document.querySelectorAll(".desktop-view button")].find(
      (button) => /account/i.test(button.textContent || ""),
    );
    tab?.click();
  });
  await page.waitForTimeout(2500);

  log.card = await page.evaluate(() => {
    const card = document.querySelector(".desktop-support-card");
    if (!card) return null;
    return {
      text: card.innerText,
      rows: card.querySelectorAll(".support-channel").length,
      state: card.querySelector(".support-channels-state")?.innerText || null,
    };
  });
  log.rows = await page.evaluate(() =>
    [...document.querySelectorAll(".support-channel")].map((row) => ({
      tag: row.tagName,
      href: row.getAttribute("href"),
      target: row.getAttribute("target"),
      rel: row.getAttribute("rel"),
      label: row.getAttribute("aria-label"),
      text: row.innerText,
    })),
  );

  const cardBox = await page.evaluate(() => {
    const card = document.querySelector(".desktop-support-card");
    if (!card) return null;
    card.scrollIntoView({ block: "center" });
    return true;
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: ".tmp-support-probe.png" });
  log.cardBox = cardBox;
  return log;
}
