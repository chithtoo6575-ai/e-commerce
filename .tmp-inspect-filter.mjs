// Inspects the filter card + header buttons.
export default async function run(page) {
  return page.evaluate(() => {
    const filterCard = document.querySelector(".filter-card");
    const header = document.querySelector(".page-header-actions");
    return {
      path: location.pathname,
      filterCardHtml: filterCard ? filterCard.outerHTML.slice(0, 3000) : null,
      headerButtons: header
        ? [...header.querySelectorAll("button")].map((b) => ({
            cls: b.className,
            text: b.textContent.trim(),
          }))
        : null,
      dateInputs: [
        ...document.querySelectorAll(".filter-card input[type=date]"),
      ].map((el) => ({
        cls: el.className,
        aria: el.getAttribute("aria-label"),
        value: el.value,
      })),
      rows: document.querySelectorAll(".order-details-table tbody tr").length,
    };
  });
}
