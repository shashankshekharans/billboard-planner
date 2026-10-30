// The page the CLI builds (npm run build:example), opened as a file the way someone opens an emailed plan.
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, test, type Page } from "@playwright/test";

const FILE = resolve("examples/aaj-swift-nh48/plan.html");
test.skip(!existsSync(FILE), "Run npm run build:example first");

const leaflet = <T,>(page: Page, expr: string) => page.evaluate(e => (0, eval)(e), expr) as Promise<T>;
const center = (page: Page) => leaflet<string>(page, "(c => c.lat.toFixed(6) + ',' + c.lng.toFixed(6))(map.getCenter())");

test.beforeEach(async ({ page }) => {
  await page.goto(pathToFileURL(FILE).href);
  await expect(page.locator(".pin")).toHaveCount(8);
  await page.waitForTimeout(300);
});

test("map, pins, warehouse, rings and totals", async ({ page }) => {
  await expect(page.locator(".leaflet-container")).toBeVisible();
  await expect(page.locator(".wh-chip img")).toHaveCount(1);
  await expect(page.locator(".ring-label")).toHaveText(["20 km from Gurgaon", "50 km from Gurgaon"]);
  await expect(page.locator("tfoot")).toContainText("₹4,66,000*");
  await expect(page.locator("#stats")).toContainText("8,250 sq ft");
  await expect(page.locator("tr.site")).toHaveCount(8);
  await expect(page.locator("#row-1")).toContainText("30.3 km");
});

test("hover card: opens beside the pin without panning, stays inside the map, closes 300 ms after leaving", async ({ page }) => {
  const before = await center(page);
  const pin = page.locator("#pin-8");
  await pin.hover();
  const card = page.locator("#card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Binalo – Near Stella Showroom");
  await expect(card).toContainText("9.1 km");
  await expect(card).toContainText("*Printing & mounting extra. GST extra.");
  expect(await center(page)).toBe(before);

  const map = (await page.locator(".map-shell").boundingBox())!, box = (await card.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(map.x);
  expect(box.y).toBeGreaterThanOrEqual(map.y);
  expect(box.x + box.width).toBeLessThanOrEqual(map.x + map.width + 1);

  // Stays open while the mouse is on the card; photo arrows step through Binalo's three photos
  await card.hover();
  await expect(card.locator(".count")).toHaveText("1 / 3");
  await card.locator(".nav.next").click();
  await expect(card.locator(".count")).toHaveText("2 / 3");
  // Leaving the card (without crossing other pins) closes it after 300 ms, not at once. Timed inside the page.
  const closedAfter = await card.evaluate(el => new Promise<number>(done => {
    const t0 = performance.now();
    el.dispatchEvent(new MouseEvent("mouseleave"));
    const check = () => (el as HTMLElement).hidden ? done(performance.now() - t0) : requestAnimationFrame(check);
    check();
  }));
  expect(closedAfter).toBeGreaterThanOrEqual(290);
  expect(closedAfter).toBeLessThan(1500);
});

test("clicking a table row flies to the site at zoom 17 and opens its card", async ({ page }) => {
  await page.locator("#row-3").click();
  await expect(page.locator("#card")).toBeVisible();
  await expect(page.locator("#card")).toContainText("Opp. N.H. Desi Hotel");
  expect(await leaflet<number>(page, "map.getZoom()")).toBe(17);
  expect(await center(page)).toBe("28.186815,76.722692");
  await expect(page.locator("#pin-3")).toHaveClass(/active/);
});

test("Enter on a focused row does the same", async ({ page }) => {
  await page.locator("#row-7").focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#card")).toContainText("Delhi Road – Dharuhera");
});

test("resize handle: drag, arrow keys and double-click reset", async ({ page }) => {
  const shell = page.locator(".map-shell");
  const h0 = (await shell.boundingBox())!.height;
  const handle = (await page.locator("#resize").boundingBox())!;
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 120, { steps: 5 });
  await page.mouse.up();
  expect((await shell.boundingBox())!.height).toBeCloseTo(h0 + 120, -1);

  await page.locator("#resize").focus();
  await page.keyboard.press("ArrowDown");
  expect((await shell.boundingBox())!.height).toBeCloseTo(h0 + 160, -1);
  await page.locator("#resize").dblclick();
  expect((await shell.boundingBox())!.height).toBeCloseTo(h0, 0);
});

test("satellite / map toggle, rings checkbox and Show all sites", async ({ page }) => {
  await page.getByRole("button", { name: "Map", exact: true }).click();
  await expect(page.getByRole("button", { name: "Map", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('img.leaflet-tile[src*="World_Street_Map"]').first()).toBeAttached();
  await page.getByLabel(/20 km & 50 km from Gurgaon/).uncheck();
  await expect(page.locator(".ring-label")).toHaveCount(0);
  await page.locator("#row-1").click();
  await expect.poll(() => leaflet<number>(page, "map.getZoom()")).toBe(17);
  await page.getByRole("button", { name: "Show all sites" }).click();
  await expect.poll(() => leaflet<number>(page, "map.getZoom()")).toBeLessThan(13);
});

test("city markers for Gurgaon and Manesar, with a legend entry", async ({ page }) => {
  await expect(page.locator(".city b")).toHaveText(["Gurgaon", "Manesar"]);
  await expect(page.locator(".legend")).toContainText("City");
});

test("clicking the card photo opens it full size; arrows, Escape and the backdrop work", async ({ page }) => {
  await page.locator("#pin-8").hover();
  const card = page.locator("#card");
  await card.hover();
  await card.locator(".card-photo img").click();
  const lb = page.locator(".lightbox");
  await expect(lb).toBeVisible();
  await expect(lb.locator(".lb-cap")).toHaveText(/Binalo – Near Stella Showroom\s+·\s+1 \/ 3/);
  await expect(lb.locator(".lb-close")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(lb.locator(".lb-cap")).toContainText("2 / 3");
  await lb.locator(".lb-nav.prev").click();
  await lb.locator(".lb-nav.prev").click();
  await expect(lb.locator(".lb-cap")).toContainText("3 / 3");
  await page.keyboard.press("Escape");
  await expect(lb).toBeHidden();

  // A site with one photo has no arrows; clicking outside the photo closes it
  await page.locator("#pin-1").hover();
  await page.locator("#card").hover();
  await page.locator("#card .card-photo img").click();
  await expect(lb).toBeVisible();
  await expect(lb.locator(".lb-nav.next")).toBeHidden();
  await lb.click({ position: { x: 5, y: 300 } });
  await expect(lb).toBeHidden();
});

test("the built page reads exactly like the hand-made reference", async ({ page, browser }) => {
  const snapshot = (p: Page) => p.evaluate(() => {
    const T = (s: string) => (document.querySelector(s) as HTMLElement | null)?.innerText.replace(/\s+/g, " ").trim() ?? "";
    const show = (0, eval)("showCard") as (n: number) => void, hide = (0, eval)("hideCard") as () => void;
    const cards: string[] = [];
    for (let n = 1; n <= 8; n++) { show(n); cards.push(T("#card")); }
    hide();
    return {
      header: T("header.top"), legend: T(".legend"), stats: T("#stats"), thead: T("thead"), rows: T("#rows"), foot: T("tfoot"), notes: T(".notes"),
      cities: [...document.querySelectorAll(".city b")].map(e => e.textContent), rings: [...document.querySelectorAll(".ring-label")].map(e => e.textContent), cards
    };
  });
  const ref = await browser.newPage();
  await ref.goto(pathToFileURL(resolve("examples/aaj-swift-nh48/reference/billboard-plan-example.html")).href);
  await expect(ref.locator(".pin")).toHaveCount(8);
  expect(await snapshot(page)).toEqual(await snapshot(ref));
  await ref.close();
});
