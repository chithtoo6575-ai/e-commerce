// Signs the page in through the app's own login form, then adds a cart item via the UI.
export default async function run(page, ui) {
  const log = {};
  page.on("console", (m) => {
    if (m.type() === "error") (log.errors ||= []).push(m.text().slice(0, 300));
  });
  const status = await page.evaluate(() =>
    fetch("/api/customer/session").then((r) => r.json()),
  );
  log.before = status.customer?.email || null;

  if (!status.customer) {
    await ui.fill("@e1", process.env.QA_LOGIN || "uiqa361093@example.com");
    await ui.fill("@e2", "Password123!");
    await ui.click("@e4");
    await page.waitForTimeout(4000);
  }
  log.after = await page.evaluate(() =>
    fetch("/api/customer/session")
      .then((r) => r.json())
      .then((j) => j.customer?.email || null),
  );
  log.snapshot = await ui.snapshot();
  return log;
}
