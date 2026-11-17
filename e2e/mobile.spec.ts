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
    expect(await row.evaluate(el => getComputedStyle(el).display)).toBe("flex");
    // Compact: name and total share the first line, and a card is well under half the screen tall
    const name = (await row.locator(".loc").boundingBox())!, total = (await row.locator(".c-total").boundingBox())!;
    expect(Math.abs(name.y - total.y)).toBeLessThan(20);
    expect((await row.boundingBox())!.height).toBeLessThan(220);
    await expect(row.locator('td[data-label="Size (ft)"]')).toHaveText("80 × 30");   // units are added by CSS on phones only
    await row.locator(".loc").tap();
    await expect(page.locator("#card")).toContainText("Delhi Road – Dharuheda");
    expect(await zoomOf(page)).toBe(17);
  });
});

test.describe("shortlist on a phone", () => {
  test.skip(!existsSync(FILE), "Run npm run build:example first");
  test("adding a site shows the shortlist bar at the bottom of the screen", async ({ page }) => {
    await page.goto(pathToFileURL(FILE).href);
    await expect(page.locator(".pin")).toHaveCount(8);
    await page.locator("#pin-8").tap();
    await page.waitForTimeout(600);
    await page.locator("#card").getByRole("button", { name: "Add to shortlist" }).tap();
    const bar = page.locator(".slbar");
    await expect(bar).toContainText("1 site · ₹1,50,000*");
    const box = (await bar.boundingBox())!, vh = page.viewportSize()!.height;
    expect(box.y + box.height).toBeLessThanOrEqual(vh + 1);
    expect(box.y + box.height).toBeGreaterThan(vh - 40);
  });
});

test.describe("site card on a phone", () => {
  test.skip(!existsSync(FILE), "Run npm run build:example first");
  test("opens as a sheet at the bottom of the map, with total and distance in view, clear of the zoom buttons", async ({ page }) => {
    await page.goto(pathToFileURL(FILE).href);
    await expect(page.locator(".pin")).toHaveCount(8);
    await page.locator("#pin-1").tap();
    const card = page.locator("#card");
    await expect(card).toBeVisible();
    const map = (await page.locator(".map-shell").boundingBox())!, box = (await card.boundingBox())!;
    expect(Math.abs(box.y + box.height - (map.y + map.height))).toBeLessThan(3);
    expect(box.height).toBeLessThanOrEqual(map.height * 0.62);
    expect(Math.abs(box.width - map.width)).toBeLessThan(3);
    const quick = card.locator(".card-quick");
    await expect(quick).toContainText("₹48,000");
    await expect(quick).toContainText("30.3 km");
    const q = (await quick.boundingBox())!;
    expect(q.y + q.height).toBeLessThanOrEqual(box.y + box.height);
    const zoom = (await page.locator(".leaflet-control-zoom").boundingBox())!;
    expect(zoom.y + zoom.height).toBeLessThan(box.y);
  });
});

test.describe("touch targets on a phone", () => {
  test.skip(!existsSync(FILE), "Run npm run build:example first");
  test("Map key and pins are comfortable to tap", async ({ page }) => {
    await page.goto(pathToFileURL(FILE).href);
    await expect(page.locator(".pin")).toHaveCount(8);
    expect((await page.locator("#legend summary").boundingBox())!.height).toBeGreaterThanOrEqual(44);
    // a tap 18 px from pin 1's centre (on its free side; a pin group sits to its right) still lands on pin 1
    const hits = await page.evaluate(() => {
      const r = document.getElementById("pin-1")!.getBoundingClientRect(), x = r.x + r.width / 2, y = r.y + r.height / 2;
      return [[-18, 0], [0, -18], [0, 18]].map(([dx, dy]) => document.elementFromPoint(x + dx!, y + dy!)?.closest(".pin")?.id);
    });
    expect(hits).toEqual(["pin-1", "pin-1", "pin-1"]);
  });
});

test.describe("overlapping pins on a phone", () => {
  test.skip(!existsSync(FILE), "Run npm run build:example first");
  test("nearby pins merge into a numbered group that zooms in when tapped; Show all sites groups them again", async ({ page }) => {
    await page.goto(pathToFileURL(FILE).href);
    await expect(page.locator(".pin")).toHaveCount(8);
    const group = page.locator(".cluster").first();
    await expect(group).toBeVisible();
    const sites = (await group.getAttribute("data-sites"))!.split(",");
    expect(sites.length).toBeGreaterThanOrEqual(2);
    // group discs never overlap each other
    const boxes = await page.locator(".cluster").evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => [r.x, r.y, r.right, r.bottom]));
    for (let a = 0; a < boxes.length; a++) for (let b = a + 1; b < boxes.length; b++) {
      const [p, q] = [boxes[a]!, boxes[b]!];
      expect(p[2]! <= q[0]! || q[2]! <= p[0]! || p[3]! <= q[1]! || q[3]! <= p[1]!).toBe(true);
    }
    await expect(group).toHaveText(String(sites.length));
    for (const n of sites) await expect(page.locator(`#pin-${n}`)).toBeHidden();
    const zoom = await page.evaluate(() => (0, eval)("map.getZoom()") as number);
    await group.tap();
    await expect.poll(() => page.evaluate(() => (0, eval)("map.getZoom()") as number)).toBeGreaterThan(zoom);
    // the group has split: its sites no longer sit in one group, and at least one shows as its own pin
    await expect(page.locator(`.cluster[data-sites="${sites.join(",")}"]`)).toHaveCount(0);
    const visible = await Promise.all(sites.map(n => page.locator(`#pin-${n}`).isVisible()));
    expect(visible.some(Boolean)).toBe(true);
    await page.getByRole("button", { name: "Show all sites" }).tap();
    await expect(page.locator(".cluster").first()).toBeVisible();
  });

  test("ring labels sit on the west side of their circles, clear of the map controls", async ({ page }) => {
    await page.goto(pathToFileURL(FILE).href);
    await expect(page.locator(".pin")).toHaveCount(8);
    const below = await page.evaluate(() => (0, eval)("ringLayer.getLayers().every((g, i) => g.getLayers()[1].getLatLng().lng < ringCircles[i].getLatLng().lng)"));
    expect(below).toBe(true);
  });
});
