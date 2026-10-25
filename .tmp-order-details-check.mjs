// Opens the admin Orders page, opens the first order's detail drawer,
// and reports the itemized "အော်ဒါအသေးစိတ်" table.
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
  if (loginStatus !== 200) return { loginStatus };

  await page.goto("http://localhost:5173/my-online-shop/admin/orders", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".admin-table .admin-icon-btn", {
    timeout: 30000,
  });
  await page.waitForTimeout(1200);
  await page.locator(".admin-table .admin-icon-btn").first().click();
  await page.waitForSelector(".order-details-table", { timeout: 20000 });
  await page.waitForTimeout(600);

  const report = await page.evaluate(() => {
    const table = document.querySelector(".order-details-table");
    const headers = [...table.querySelectorAll("thead th")].map((th) =>
      th.textContent.trim(),
    );
    const rows = [...table.querySelectorAll("tbody tr")].map((tr) =>
      [...tr.children].map((td) => td.textContent.trim()),
    );
    const section = table.closest(".drawer-section");
    const heading = section?.querySelector("h5")?.textContent.trim();
    return {
      heading,
      headers,
      headerCount: headers.length,
      rowCount: rows.length,
      rows: rows.slice(0, 6),
      emptyState: rows.length === 1 && rows[0].length === 1,
    };
  });

  await page.locator(".order-details-table").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  const box = await page.locator(".order-details-table").boundingBox();
  await page.screenshot({
    path: ".tmp-order-details-shot.png",
    clip: {
      x: Math.max(0, box.x - 20),
      y: Math.max(0, box.y - 60),
      width: Math.min(1440, box.width + 40),
      height: Math.min(900, box.height + 90),
    },
  });

  return { loginStatus, ...report };
}
