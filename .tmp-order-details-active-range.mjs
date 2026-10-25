// Screenshot with an active date range applied.
export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("http://localhost:5173/my-online-shop/admin/order-details", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".admin-page-content .order-details-table", {
    timeout: 30000,
  });
  await page.waitForTimeout(1200);

  const before = await page.evaluate(
    () => document.querySelectorAll(".order-details-table tbody tr").length,
  );

  await page.locator(".date-range-field input").nth(0).fill("2026-10-24");
  await page.locator(".date-range-field input").nth(1).fill("2026-10-24");
  await page.waitForTimeout(700);

  const state = await page.evaluate(() => ({
    rows: document.querySelectorAll(
      ".admin-page-content .order-details-table tbody tr",
    ).length,
    summary: document
      .querySelector(".filter-summary")
      ?.innerText.split(/\s+/)
      .filter(Boolean)
      .join(String.fromCharCode(32)),
    clearVisible: Boolean(document.querySelector(".date-range-clear")),
  }));

  await page.screenshot({ path: ".tmp-order-details-range.png" });
  return { before, state };
}
