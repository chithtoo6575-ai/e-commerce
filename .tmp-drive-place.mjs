export default async function run(page, ui) {
  const log = {};
  page.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warning")
      (log.errors ||= []).push(m.type() + ": " + m.text().slice(0, 400));
  });
  page.on("request", (r) => {
    if (/\/api\/(orders|customer\/cart)/.test(r.url()))
      (log.requests ||= []).push(
        `${r.method()} ${new URL(r.url()).pathname} body=${(r.postData() || "").slice(0, 500)}`,
      );
  });
  page.on("response", async (r) => {
    if (/\/api\/(orders|customer\/cart)/.test(r.url())) {
      let body = "";
      try {
        body = (await r.text()).slice(0, 250);
      } catch {}
      (log.responses ||= []).push(
        `${r.request().method()} ${new URL(r.url()).pathname} -> ${r.status()} ${body}`,
      );
    }
  });

  const cod = page.getByRole("radio", { name: "cod" });
  if (await cod.count()) {
    await cod.click({ force: true });
    await page.waitForTimeout(800);
  }
  const place = page.getByRole("button", { name: /^Place Order/ }).first();
  log.placeDisabled = await place.isDisabled().catch(() => null);
  if (!log.placeDisabled) {
    await place.click({ force: true });
    await page.waitForTimeout(5000);
  }
  log.after = (await page.evaluate(() => document.body.innerText)).slice(
    0,
    600,
  );
  log.snapshot = await ui.snapshot();
  await page.screenshot({ path: ".tmp-repro-checkout.png" });
  return log;
}
