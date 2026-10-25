// Signs in, screenshots the mobile product grid at 390px, and measures one card.
export default async function run(page) {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto("http://localhost:5173/my-online-shop/", { waitUntil: "domcontentloaded" })
  const login = await page.evaluate(async () => {
    localStorage.setItem("shop_onboarding_seen", "1")
    const res = await fetch("/api/customer/phone/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier: "qa4000025@example.com", password: "Password123!" }),
    })
    return res.status
  })
  await page.reload({ waitUntil: "domcontentloaded" })
  await page.waitForSelector(".mob-product-grid .mob-product-card", { timeout: 25000 })
  await page.waitForTimeout(2500)

  const metrics = await page.evaluate(() => {
    const grid = document.querySelector(".mob-product-grid")
    const card = grid.querySelector(".mob-product-card")
    const rect = (el) => {
      if (!el) return null
      const r = el.getBoundingClientRect()
      return { w: Math.round(r.width), h: Math.round(r.height) }
    }
    const rows = [...grid.querySelectorAll(".mob-product-grid .mob-product-card")].slice(0, 4)
    return {
      login: true,
      columns: getComputedStyle(grid).gridTemplateColumns,
      card: rect(card),
      image: rect(card.querySelector(".mob-card-img-wrap")),
      title: rect(card.querySelector(".mob-card-title")),
      heart: rect(card.querySelector(".mob-card-heart")),
      tags: [...card.querySelectorAll(".mob-card-tag")].map((t) => t.textContent),
      tagRect: rect(card.querySelector(".mob-card-tag")),
      stars: card.querySelectorAll(".mob-card-stars svg").length,
      reviews: card.querySelector(".mob-card-reviews")?.textContent,
      addBtn: rect(card.querySelector(".mob-card-add-btn")),
      rowTopHeights: rows.map((r) => Math.round(r.getBoundingClientRect().height)),
    }
  })
  await page.screenshot({ path: ".tmp-card-shot.png" })
  return { loginStatus: login, ...metrics }
}
