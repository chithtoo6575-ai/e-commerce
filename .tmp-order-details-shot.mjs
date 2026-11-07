// Screenshot of the new order details page (no drawer).
export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const loginStatus = await page.evaluate(async () => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "chithtoo6575@gmail.com",
        password: "Ch1266172967",
      }),
    });
    return res.status;
  });
  await page.goto("http://localhost:5173/my-online-shop/admin/order-details", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".admin-page-content .order-details-table", {
    timeout: 30000,
  });
  await page.waitForTimeout(1500);
  const headers = await page.evaluate(() =>
    [
      ...document.querySelectorAll(
        ".admin-page-content .order-details-table thead th",
      ),
    ].map((th) => th.textContent.trim()),
  );
  await page.screenshot({ path: ".tmp-order-details-page.png" });
  return { loginStatus, headers };
}
