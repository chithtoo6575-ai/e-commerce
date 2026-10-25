// Verifies the နံပါတ်စဉ် column is one continuous 1..n index on the order-details page.
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

  await page.goto("http://localhost:5173/my-online-shop/admin/order-details", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForSelector(".admin-page-content .order-details-table", {
    timeout: 30000,
  });
  await page.waitForTimeout(1200);

  const readSerials = () =>
    page.evaluate(() =>
      [
        ...document.querySelectorAll(
          ".admin-page-content .order-details-table tbody tr",
        ),
      ].map((tr) => ({
        serial: tr.children[0]?.textContent.trim(),
        voucher: tr.children[1]?.textContent.trim(),
      })),
    );

  const check = (rows) => {
    const serials = rows.map((r) => Number(r.serial));
    const expected = rows.map((_, i) => i + 1);
    return {
      count: rows.length,
      first: serials.slice(0, 5),
      last: serials.slice(-3),
      isSequential: serials.every((value, i) => value === expected[i]),
      duplicateVouchers: rows.length - new Set(rows.map((r) => r.voucher)).size,
    };
  };

  const full = check(await readSerials());

  // Narrow to one day: numbering must restart at 1 and stay continuous for the filtered set.
  await page.locator(".date-range-field input").nth(0).fill("2026-10-24");
  await page.locator(".date-range-field input").nth(1).fill("2026-10-24");
  await page.waitForTimeout(700);
  const filtered = check(await readSerials());

  // Clear back to the full list.
  await page.locator(".date-range-clear").click();
  await page.waitForTimeout(500);
  const restored = check(await readSerials());

  await page.screenshot({ path: ".tmp-order-details-serial.png" });
  return { loginStatus, full, filtered, restored };
}
