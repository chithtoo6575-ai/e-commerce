// Opens an order's voucher drawer and captures the print rendering.
export default async function run(page) {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('http://localhost:5173/my-online-shop/admin/orders', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.admin-page-content', { timeout: 30000 })
  await page.waitForTimeout(1500)

  // Open the first order's drawer.
  const opened = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.admin-table tbody tr')]
    const row = rows.find((tr) => tr.querySelector('.admin-icon-btn'))
    if (!row) return false
    row.querySelector('.admin-icon-btn').click()
    return true
  })
  await page.waitForSelector('.order-voucher', { timeout: 15000 })
  await page.waitForTimeout(800)

  // Screen view.
  await page.locator('.order-voucher').screenshot({ path: '.tmp-voucher-screen.png' })

  // Print emulation.
  await page.emulateMedia({ media: 'print' })
  await page.waitForTimeout(600)

  const layout = await page.evaluate(() => {
    const voucher = document.querySelector('.order-voucher')
    const body = document.querySelector('.drawer-body')
    const box = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      const cs = getComputedStyle(el)
      return {
        h: Math.round(r.height),
        w: Math.round(r.width),
        display: cs.display,
        visible: cs.visibility,
        bg: cs.backgroundColor,
        border: `${cs.borderTopWidth} ${cs.borderTopStyle}`,
      }
    }
    return {
      pageSize: 'A4 297mm tall',
      voucher: box(voucher),
      drawerBody: box(body),
      header: box(document.querySelector('.order-voucher-header')),
      tableWrap: box(document.querySelector('.order-voucher-table-wrap')),
      summary: box(document.querySelector('.order-voucher-summary')),
      financials: box(document.querySelector('.order-voucher-financials')),
      footer: box(document.querySelector('.drawer-footer')),
      editor: box(document.querySelector('.order-voucher-editor')),
      items: document.querySelectorAll('.order-voucher-table tbody tr').length,
      // anything else still visible inside the overlay
      visibleOverlayChildren: [...document.querySelectorAll('.order-detail-overlay .drawer-body > *')].map((el) => ({
        cls: el.className,
        display: getComputedStyle(el).display,
        visibility: getComputedStyle(el).visibility,
        h: Math.round(el.getBoundingClientRect().height),
      })),
    }
  })

  await page.screenshot({ path: '.tmp-voucher-print-full.png', fullPage: true })
  await page.emulateMedia({ media: 'screen' })
  return { opened, layout }
}
