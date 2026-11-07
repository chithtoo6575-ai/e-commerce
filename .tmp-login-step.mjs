// Logs in on the page currently open in the session.
export default async function run(page) {
  const loginStatus = await page.evaluate(async () => {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "chithtoo6575@gmail.com",
        password: "Ch1266172967",
      }),
    });
    return {
      status: res.status,
      setCookie: res.headers.get("set-cookie") ? true : false,
    };
  });
  await page.goto("http://localhost:5173/my-online-shop/admin/order-details", {
    waitUntil: "domcontentloaded",
  });
  await page
    .waitForSelector(".admin-page-content .order-details-table", {
      timeout: 30000,
    })
    .catch(() => null);
  await page.waitForTimeout(1500);
  return {
    loginStatus,
    path: await page.evaluate(() => location.pathname),
    hasTable: await page.evaluate(() =>
      Boolean(
        document.querySelector(".admin-page-content .order-details-table"),
      ),
    ),
    text: (await page.evaluate(() => document.body.innerText)).slice(0, 300),
  };
}
