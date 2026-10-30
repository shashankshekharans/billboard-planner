// Phone checks (iPhone 13 size, touch): the app's example and editor, and the generated page as someone opens it from WhatsApp.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const FILE = resolve("examples/aaj-swift-nh48/plan.html");
const zoomOf = (page: Page) => page.evaluate(() => (0, eval)("map.getZoom()") as number);
const noSideScroll = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

test.describe("app on a phone", () => {
  test("#example shows the plan filling the screen, with a compact menu", async ({ page }) => {
    await page.goto("/#example");
    const frame = page.locator('iframe[title="Plan page preview"]');
    const f = page.frameLocator('iframe[title="Plan page preview"]');
    await expect(f.locator(".pin")).toHaveCount(8);
    expect((await frame.boundingBox())!.height).toBeGreaterThan(400);
    expect(await noSideScroll(page)).toBe(0);
    await expect(page.getByRole("button", { name: "Start a new plan" })).toBeHidden();
    await page.getByRole("button", { name: "Menu" }).tap();
    await expect(page.getByRole("button", { name: "Start a new plan" })).toBeVisible();
  });

  test("editor preview fits all sites when it is first shown", async ({ page }) => {
    await page.goto("/#example");
    await page.getByRole("button", { name: "Duplicate as my plan" }).tap();
    await expect(page.getByRole("tab", { name: /Sites/ })).toBeVisible();
    await page.getByRole("button", { name: "Preview", exact: true }).tap();
    const f = page.frameLocator('iframe[title="Plan page preview"]');
    await expect(f.locator(".pin")).toHaveCount(8);
    await expect.poll(() => f.locator("body").evaluate(() => (0, eval)("map.getZoom()") as number)).toBeLessThan(13);
  });
});

test.describe("generated page on a phone", () => {
  test.skip(!existsSync(FILE), "Run npm run build:example first");
  test.beforeEach(async ({ page }) => {
    await page.goto(pathToFileURL(FILE).href);
    await expect(page.locator(".pin")).toHaveCount(8);
    await page.waitForTimeout(300);
  });

  test("fits the screen: no sideways scrolling, header stacked, legend folded", async ({ page }) => {
    expect(await noSideScroll(page)).toBe(0);
    const logo = (await page.locator("#logo").boundingBox())!, title = (await page.locator(".title h1").boundingBox())!;
    expect(title.y).toBeGreaterThan(logo.y + logo.height - 1);
    await expect(page.locator("#legend")).not.toHaveAttribute("open", "");
    await page.locator("#legend summary").tap();
    await expect(page.locator("#legend")).toHaveAttribute("open", "");
    await expect(page.locator("#legend")).toContainText("City");
  });

  test("pins are not covered by the legend, the warehouse marker or city labels", async ({ page }) => {
    const hits = await page.evaluate(() => [1, 8].map(n => {
      const r = document.getElementById("pin-" + n)!.getBoundingClientRect();
      return document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest(".pin")?.id;
    }));
    expect(hits).toEqual(["pin-1", "pin-8"]);
  });

  test("tapping a pin opens its card (not the photo viewer); × closes it; the photo opens full size", async ({ page }) => {
    await page.locator("#pin-8").tap();
    const card = page.locator("#card");
    await expect(card).toBeVisible();
    await expect(card).toContainText("Binalo – Near Stella Showroom");
    await page.waitForTimeout(900);
    await expect(card).toBeVisible();                       // touch: no hover auto-close
    await expect(page.locator(".lightbox")).toBeHidden();   // the tap did not also open the photo
    await card.locator(".card-photo img").tap();
    await expect(page.locator(".lightbox")).toBeVisible();
    await page.locator(".lb-close").tap();
    await card.locator(".card-close").tap();
    await expect(card).toBeHidden();
  });

  test("the table becomes one card per site, and tapping one flies to it", async ({ page }) => {
    await expect(page.locator("thead")).toBeHidden();
    const row = page.locator("#row-6");
    await expect(row.locator('td[data-label="Rate / month"]')).toContainText("₹72,000");
    expect(await row.evaluate(el => getComputedStyle(el).display)).toBe("grid");
    await row.locator(".loc").tap();
    await expect(page.locator("#card")).toContainText("Delhi Road – Dharuheda");
    expect(await zoomOf(page)).toBe(17);
  });
});
