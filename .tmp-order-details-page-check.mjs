// Verifies the new "အော်ဒါအသေးစိတ်" sidebar entry and its dedicated page.
export default async function run(page) {
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

  await page.goto('http://localhost:5173/my-online-shop/admin/orders', { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.sidebar-label', { timeout: 30000 })

  // 1) Sidebar: the new entry sits directly under Orders.
  const sidebar = await page.evaluate(() => {
    const labels = [...document.querySelectorAll('.sidebar-label')].map((el) => el.textContent.trim())
    const ordersIndex = labels.indexOf('အော်ဒါများ')
    return { labels, ordersIndex, next: labels[ordersIndex + 1] }
  })

  // 2) Click it and check the dedicated page renders.
  await page.getByText('အော်ဒါအသေးစိတ်', { exact: true }).first().click()
  await page.waitForTimeout(1200)
  await page.waitForSelector('.admin-page-content .order-details-table', { timeout: 20000 })

  const detailsPage = await page.evaluate(() => {
    const table = document.querySelector('.admin-page-content .order-details-table')
    const headers = [...table.querySelectorAll('thead th')].map((th) => th.textContent.trim())
    const bodyRows = [...table.querySelectorAll('tbody tr')]
    return {
      path: window.location.pathname,
      heading: document.querySelector('.header-page-title')?.textContent.trim(),
      pageTitle: document.querySelector('.page-header-actions h2')?.textContent.trim(),
      headers,
      rowCount: bodyRows.length,
      rows: bodyRows.slice(0, 4).map((tr) => [...tr.children].map((td) => td.textContent.trim())),
      filterCount: document.querySelectorAll('.filter-card select, .filter-card input').length,
    }
  })

  // 3) Opening a row should show the itemized table in a read-only drawer.
  await page.locator('.admin-page-content .order-details-table .admin-icon-btn').first().click()
  await page.waitForSelector('.order-drawer-wide', { timeout: 15000 })
  await page.waitForTimeout(600)
  const drawer = await page.evaluate(() => {
    const drawerEl = document.querySelector('.order-drawer-wide')
    return {
      open: Boolean(drawerEl),
      serials: [...drawerEl.querySelectorAll('.order-details-table tbody tr')].map((tr) => tr.children[0].textContent.trim()),
      footerButtons: [...drawerEl.querySelectorAll('.drawer-footer button')].map((b) => b.textContent.trim()),
      hasEditableStatusBar: Boolean(drawerEl.querySelector('.order-quick-status-bar')),
    }
  })

  await page.screenshot({ path: '.tmp-order-details-page.png' })
  return { loginStatus, sidebar, detailsPage, drawer }
}
