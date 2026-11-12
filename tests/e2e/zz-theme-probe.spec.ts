import { expect, test } from "@playwright/test";

for (const theme of ["Goth", "Ransom", "Dark"]) {
  test(`icon contrast probe: ${theme}`, async ({ page }) => {
    await page.goto("/");
    await page.evaluate((t) => {
      (
        window as unknown as {
          __settingsStore: { getState: () => { setRaw: (v: Record<string, unknown>) => void } };
        }
      ).__settingsStore.getState().setRaw({ themeType: t });
    }, theme);
    await page.waitForTimeout(300);
    const cardIcon = page.locator(".ewpp-card-icon").first();
    await expect(cardIcon).toBeVisible();
    const probe = await cardIcon.evaluate((el) => {
      const cs = getComputedStyle(el);
      const nav = document.querySelector(".ewpp-nav-item");
      const ncs = nav ? getComputedStyle(nav) : null;
      const navActive = document.querySelector(".ewpp-nav-item-active");
      const acs = navActive ? getComputedStyle(navActive) : null;
      return {
        iconColor: cs.color,
        iconBg: cs.backgroundColor,
        navColor: ncs?.color,
        navBg: ncs?.backgroundColor,
        activeColor: acs?.color,
        activeBg: acs?.backgroundColor,
      };
    });
    console.log(theme, JSON.stringify(probe));
    await page.screenshot({ path: `work/stress/theme-probe-${theme}.png`, fullPage: false });
  });
}
