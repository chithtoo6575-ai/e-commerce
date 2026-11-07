// Verify the storefront Help & Support channels render from the live API.
export default async function run(page, ui) {
  const log = {};
  const API = "http://localhost:8787";

  // Publish two active channels and one inactive channel through the public API shape.
  const current = await (await fetch(API + "/api/support-channels")).json();
  log.publicBefore = current;

  await page.goto("http://localhost:5173/my-online-shop/", {
    waitUntil: "domcontentloaded",
  });
  await page.evaluate(() => localStorage.setItem("shop_onboarding_seen", "1"));

  // Land on the account tab at desktop width so the Help & Support card renders.
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.setViewportSize({ width: 1280, height: 1000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    const tab = [...document.querySelectorAll("button")].find((b) =>
      /account/i.test(b.getAttribute("aria-label") || b.textContent || ""),
    );
    tab?.click();
  });
  await page.waitForTimeout(1500);

  log.snap = await ui.snapshot();
  log.card = await page.evaluate(() => {
    const card = document.querySelector(".desktop-support-card");
    if (!card) return null;
    const rect = card.getBoundingClientRect();
    return {
      html: card.innerText,
      rows: card.querySelectorAll(".support-channel").length,
      anchors: [...card.querySelectorAll("a.support-channel")].map((a) =>
        a.getAttribute("href"),
      ),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    };
  });
  return log;
}
