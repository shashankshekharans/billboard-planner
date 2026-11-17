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

test("planner pins (Gurgaon and Manesar, kind city) with a legend entry per kind", async ({ page }) => {
  await expect(page.locator(".place.k-city b")).toHaveText(["Gurgaon", "Manesar"]);
  await expect(page.locator(".legend")).toContainText("City");
});

async function addMyPin(page: Page, name: string, at = { x: 300, y: 150 }) {
  await page.getByRole("button", { name: "Add a pin" }).click();
  const map = (await page.locator("#map").boundingBox())!;
  await page.mouse.click(map.x + at.x, map.y + at.y);
  await page.getByLabel("Pin name").fill(name);
  await page.getByRole("button", { name: "Save pin" }).click();
}

test("a viewer can add their own pin; it is escaped, kept after reload, and can be removed", async ({ page }) => {
  await addMyPin(page, "<b>Store & Co</b>");
  const mine = page.locator(".place.mine b");
  await expect(mine).toHaveText(["<b>Store & Co</b>"]);
  await expect(page.locator("#mypins-list")).toContainText("<b>Store & Co</b>");
  await page.reload();
  await expect(page.locator(".pin")).toHaveCount(8);
  await expect(mine).toHaveText(["<b>Store & Co</b>"]);
  await page.getByRole("button", { name: "Remove <b>Store & Co</b>" }).click();
  await expect(mine).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".pin")).toHaveCount(8);
  await expect(mine).toHaveCount(0);
});

test("adding a pin still works when the browser blocks storage", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } });
  });
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.reload();
  await expect(page.locator(".pin")).toHaveCount(8);
  await addMyPin(page, "Depot");
  await expect(page.locator(".place.mine b")).toHaveText(["Depot"]);
  expect(errors).toEqual([]);
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

// The reference predates the viewer tools (my pins, ring sliders, shortlist), so those controls are left out;
// everything the reference shows must read the same.
test("the built page reads like the hand-made reference", async ({ page, browser }) => {
  const snapshot = (p: Page) => p.evaluate(() => {
    const T = (s: string) => (document.querySelector(s) as HTMLElement | null)?.innerText.replace(/\s+/g, " ").trim() ?? "";
    const show = (0, eval)("showCard") as (n: number) => void, hide = (0, eval)("hideCard") as () => void;
    const cards: string[] = [];
    for (let n = 1; n <= 8; n++) {
      show(n);
      document.querySelectorAll<HTMLElement>("#card .shortlist-btn").forEach(e => { e.style.display = "none"; });   // viewer control, not in the reference
      cards.push(T("#card"));
    }
    hide();
    return {
      header: T("header.top"), legend: [...document.querySelectorAll(".legend span")].filter(e => !e.closest(".mypins, .ringctl")).map(e => e.textContent!.trim()), stats: T("#stats"), thead: T("thead"), rows: T("#rows"), foot: T("tfoot"), notes: T(".notes"),
      cities: [...document.querySelectorAll(".city b, .place.k-city b")].map(e => e.textContent), rings: [...document.querySelectorAll(".ring-label")].map(e => e.textContent), cards
    };
  });
  const ref = await browser.newPage();
  await ref.goto(pathToFileURL(resolve("examples/aaj-swift-nh48/reference/billboard-plan-example.html")).href);
  await expect(ref.locator(".pin")).toHaveCount(8);
  expect(await snapshot(page)).toEqual(await snapshot(ref));
  await ref.close();
});

test("radius sliders resize the rings, count the sites inside, change centre, reset and are remembered", async ({ page }) => {
  const radius = (i: number) => leaflet<number>(page, `ringCircles[${i}].getRadius()`);
  const centreLat = () => leaflet<number>(page, `ringCircles[0].getLatLng().lat`);
  const first = page.getByLabel("Ring 1 radius in km"), second = page.getByLabel("Ring 2 radius in km");
  await expect(first).toHaveValue("20");
  await expect(second).toHaveValue("50");
  await expect(first).toHaveAttribute("min", "1");
  await expect(first).toHaveAttribute("max", "100");
  await first.fill("10");
  expect(await radius(0)).toBe(10000);
  await expect(page.locator(".ring-label").first()).toHaveText("10 km from Gurgaon");
  await page.getByLabel("Ring centre").selectOption({ label: "AAJ Swift Warehouse" });
  expect(await centreLat()).toBeCloseTo(28.241322, 5);
  await expect(page.locator(".ringctl")).toContainText("10 km: 1 site");
  await expect(page.locator(".ring-label").first()).toHaveText("10 km from AAJ Swift Warehouse");
  await page.reload();
  await expect(page.locator(".pin")).toHaveCount(8);
  expect(await radius(0)).toBe(10000);
  expect(await centreLat()).toBeCloseTo(28.241322, 5);
  await page.getByRole("button", { name: "Reset rings" }).click();
  expect(await radius(0)).toBe(20000);
  expect(await radius(1)).toBe(50000);
  expect(await centreLat()).toBeCloseTo(28.4595, 4);
});

test("a viewer's own pin can be the ring centre", async ({ page }) => {
  await addMyPin(page, "Client office");
  await page.getByLabel("Ring centre").selectOption({ label: "My pin: Client office" });
  const pin = await page.evaluate(() => JSON.parse(localStorage.getItem("bbp:v1:Billboard Plan")!).pins[0]);
  expect(await leaflet<number>(page, "ringCircles[0].getLatLng().lat")).toBeCloseTo(pin.lat, 5);
});

test("shortlist: card button and table checkbox agree; bar totals; WhatsApp text; filter; remembered", async ({ page }) => {
  await page.locator("#pin-6").hover();
  const card = page.locator("#card");
  await card.hover();
  await card.getByRole("button", { name: "Add to shortlist" }).click();
  await expect(card.getByRole("button", { name: "Shortlisted" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel("Shortlist site 6")).toBeChecked();
  await page.getByLabel("Shortlist site 3").check();
  const bar = page.locator(".slbar");
  await expect(bar).toContainText("2 sites · ₹1,28,000");
  const href = (await bar.getByRole("link", { name: "Send on WhatsApp" }).getAttribute("href"))!;
  expect(href.startsWith("https://wa.me/?text=")).toBe(true);
  const text = decodeURIComponent(href.slice("https://wa.me/?text=".length));
  for (const part of ["Billboard Plan", "Delhi Road – Dharuheda", "Opp. N.H. Desi Hotel", "₹1,28,000", "https://www.google.com/maps?q=28.220244,76.796553"]) expect(text).toContain(part);
  await bar.getByRole("button", { name: "Show shortlist only" }).click();
  await expect(page.locator("tr.site:visible")).toHaveCount(2);
  await page.reload();
  await expect(page.locator(".pin")).toHaveCount(8);
  await expect(page.locator(".slbar")).toContainText("2 sites · ₹1,28,000");
  await page.locator(".slbar").getByRole("button", { name: "Clear" }).click();
  await expect(page.locator(".slbar")).toBeHidden();
  await expect(page.locator("tr.site:visible")).toHaveCount(8);
});

test("a shortlisted site missing from an updated plan is dropped", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("bbp:v1:Billboard Plan", JSON.stringify({ shortlist: ["99", "6"] })));
  await page.reload();
  await expect(page.locator(".pin")).toHaveCount(8);
  await expect(page.locator(".slbar")).toContainText("1 site · ₹96,000");
});
