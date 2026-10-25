export default async function run(page, ui) {
  const log = { cart: [] };
  page.on("push", () => {});
  page.on("console", (m) => {
    if (m.type() === "error") (log.errors ||= []).push(m.text().slice(0, 300));
  });
  page.on("response", async (r) => {
    if (/\/api\/customer\/cart|\/api\/orders/.test(r.url())) {
      let body = "";
      try {
        body = (await r.text()).slice(0, 300);
      } catch {}
      (log.api ||= []).push(
        `${r.request().method()} ${new URL(r.url()).pathname} -> ${r.status()} ${body}`,
      );
    }
  });

  // Add two different products
  await page
    .getByRole("button", { name: /^Add to cart: .*/ })
    .nth(0)
    .click({ force: true })
    .catch(() => {});
  await page.waitForTimeout(700);
  await page
    .getByRole("button", { name: /^Add to cart: .*/ })
    .nth(1)
    .click({ force: true })
    .catch(() => {});
  await page.waitForTimeout(1500);
  log.localBefore = await page.evaluate(() =>
    localStorage.getItem("atelier_carts"),
  );
  log.serverCartBefore = await page.evaluate(() =>
    fetch("/api/customer/cart").then((r) => r.json()),
  );

  // Expand cart then checkout
  await page
    .getByRole("button", { name: "Open cart" })
    .last()
    .click({ force: true });
  await page.waitForTimeout(1200);
  const checkout = page
    .getByRole("button", { name: /Checkout|ငွေရှင်း|ဈေးဝယ်ခြင်း/i })
    .first();
  log.checkoutVisible = await checkout.count();
  if (await checkout.count()) {
    await checkout.click({ force: true });
    await page.waitForTimeout(2000);
  }
  log.text = (await page.evaluate(() => document.body.innerText)).slice(0, 700);
  log.snapshot = await ui.snapshot();
  return log;
}
