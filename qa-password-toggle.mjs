export default async function run(page) {
  await page.waitForSelector('.admin-password-toggle', { timeout: 15000 })

  const input = page.locator('#admin-password')
  const toggle = page.locator('.admin-password-toggle')

  const read = async () => ({
    type: await input.getAttribute('type'),
    value: await input.inputValue(),
    visible: await input.isVisible(),
    toggleLabel: await toggle.getAttribute('aria-label'),
    pressed: await toggle.getAttribute('aria-pressed')
  })

  const before = await read()

  await input.fill('Secret123')
  await toggle.click()
  const shown = await read()

  // Must not have submitted the form (no error banner from the server).
  const submitted = await page
    .locator('.admin-error')
    .isVisible({ timeout: 1000 })
    .catch(() => false)

  await toggle.click()
  const hidden = await read()

  const pathsHidden = await page.locator('.admin-password-toggle svg path').count()
  await toggle.click()
  const pathsShown = await page.locator('.admin-password-toggle svg path').count()

  // Reaching it by keyboard only.
  await toggle.click()
  await input.focus()
  await page.keyboard.press('Tab')
  const focusedOnToggle = await toggle.evaluate((el) => el === document.activeElement)

  return {
    before,
    shown,
    hidden,
    formSubmitted: submitted,
    iconPaths: { hiddenState: pathsHidden, shownState: pathsShown },
    focusedOnToggle,
    pass:
      before.type === 'password' &&
      shown.type === 'text' &&
      shown.value === 'Secret123' &&
      hidden.type === 'password' &&
      hidden.value === 'Secret123' &&
      shown.toggleLabel === 'Hide password' &&
      hidden.toggleLabel === 'Show password' &&
      !submitted &&
      pathsHidden !== pathsShown &&
      focusedOnToggle
  }
}
