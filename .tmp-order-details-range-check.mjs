// Verifies the date-range filter + Print / Export PDF on the order-details page.
const SPACE = String.fromCharCode(32)
const cleanText = (value) => String(value || '').replace(/\s+/g, SPACE).trim()

export default async function run(page, ui) {
  await page.setViewportSize({ width: 1440, height: 1000 })

  const loginStatus = await page.evaluate(async () => {
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'chithtoo6575@gmail.com', password: 'Ch1266172967' }),
    })
    return res.status
  })
  if (loginStatus !== 200) return { loginStatus }

  await page.goto('http://localhost:5173/my-online-shop/admin/order-details', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.admin-page-content .order-details-table', { timeout: 30000 })
  await page.waitForTimeout(1200)

  const rowCount = () =>
    page.evaluate(() => document.querySelectorAll('.admin-page-content .order-details-table tbody tr').length)
  const printButton = page.locator('.order-details-print-btn')

  const initial = {
    rows: await rowCount(),
    dateInputs: await page.locator('.date-range-field input').count(),
    printButton: await printButton.count(),
    printLabel: (await printButton.innerText()).trim(),
    dates: await page.evaluate(() =>
      [...document.querySelectorAll('.admin-page-content .order-details-table tbody tr')]
        .slice(0, 3)
        .map((tr) => tr.children[8]?.textContent.trim()),
    ),
  }

  // A range that excludes everything -> table should be empty.
  await page.locator('.date-range-field input').nth(0).fill('2000-01-01')
  await page.locator('.date-range-field input').nth(1).fill('2000-01-02')
  await page.waitForTimeout(600)
  const emptyRange = {
    rows: await rowCount(),
    emptyText: cleanText(
      await page.evaluate(() => document.querySelector('.admin-page-content .order-details-table tbody td')?.textContent),
    ),
    summary: cleanText(await page.evaluate(() => document.querySelector('.filter-summary')?.textContent)),
  }

  // Start date after end date pushes the end date forward instead of breaking the range.
  await page.locator('.date-range-field input').nth(0).fill('2025-01-01')
  await page.waitForTimeout(400)
  const clamped = {
    from: await page.locator('.date-range-field input').nth(0).inputValue(),
    to: await page.locator('.date-range-field input').nth(1).inputValue(),
    rows: await rowCount(),
  }

  // Clear -> back to the full list.
  page.locator('.date-range-clear').click()
  await page.waitForTimeout(400)
  const cleared = {
    rows: await rowCount(),
    fromValue: await page.locator('.date-range-field input').nth(0).inputValue(),
  }

  // Popup + document check for the export button.
  const popupPromise = page.waitForEvent('popup', { timeout: 8000 }).catch(() => null)
  await printButton.click()
  const popup = await popupPromise
  let printInfo = { opened: false }
  if (popup) {
    await popup.waitForLoadState('domcontentloaded')
    printInfo = {
      opened: true,
      title: await popup.title(),
      heading: cleanText(await popup.evaluate(() => document.querySelector('h1')?.textContent)),
      meta: await popup.evaluate(() => [...document.querySelectorAll('.meta')].map((p) => p.textContent.trim())),
      headers: await popup.evaluate(() => [...document.querySelectorAll('thead th')].map((th) => th.textContent.trim())),
      bodyRows: await popup.evaluate(() => document.querySelectorAll('tbody tr').length),
      footer: cleanText(await popup.evaluate(() => document.querySelector('tfoot')?.textContent)),
    }
    await popup.screenshot({ path: '.tmp-order-details-print.png' })
    await popup.close()
  }

  await page.screenshot({ path: '.tmp-order-details-page.png' })
  return { loginStatus, initial, emptyRange, clamped, cleared, printInfo }
}
