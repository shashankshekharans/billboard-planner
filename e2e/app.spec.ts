import { readFileSync } from "node:fs";
import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import * as XLSX from "xlsx";

const pins = (f: FrameLocator) => f.locator(".pin");
// The page's Leaflet map is a top-level `const map` (window.map would be the #map element).
const mapCenter = (f: FrameLocator) => f.locator("body").evaluate(() => {
  const c = (0, eval)("map.getCenter()") as { lat: number; lng: number };
  return `${c.lat.toFixed(6)},${c.lng.toFixed(6)}`;
});

async function openExample(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /View example/ }).click();
  const f = page.frameLocator('iframe[title="Plan page preview"]');
  await expect(pins(f)).toHaveCount(8);
  return f;
}

test("start screen → View example: the AAJ Swift plan with map, 8 pins, warehouse and ₹4,66,000", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Billboard Planner" })).toBeVisible();
  for (const name of [/View example/, /Start a new plan/, /Open a plan file/]) await expect(page.getByRole("button", { name })).toBeVisible();

  const f = await openExample(page);
  await expect(page).toHaveURL(/#example$/);
  await expect(page.getByText("This is an example plan. Duplicate it to edit.")).toBeVisible();
  await expect(f.locator(".leaflet-container")).toBeVisible();
  await expect(f.locator(".wh-chip img")).toHaveCount(1);
  await expect(f.locator("tfoot")).toContainText("₹4,66,000*");
  await expect(f.locator("tfoot")).toContainText("8,250");
  await expect(f.locator(".title p")).toContainText("Sample rates for demonstration");
});

test("hovering a pin opens its card without moving the map", async ({ page }) => {
  const f = await openExample(page);
  await page.waitForTimeout(500);
  const before = await mapCenter(f);
  await pins(f).nth(5).hover();
  await expect(f.locator("#card")).toBeVisible();
  await expect(f.locator("#card")).toContainText("Delhi Road – Dharuheda");
  await expect(f.locator("#card")).toContainText("13.8 km");
  await expect(f.locator("#row-6")).toHaveClass(/hl/);
  expect(await mapCenter(f)).toBe(before);
});

test("#example opens the example directly, and Duplicate as my plan makes it editable", async ({ page }) => {
  await page.goto("/#example");
  const f = page.frameLocator('iframe[title="Plan page preview"]');
  await expect(pins(f)).toHaveCount(8);
  await page.getByRole("button", { name: "Duplicate as my plan" }).click();
  await expect(page).toHaveURL(/#edit$/);
  await expect(page.getByRole("tab", { name: /Sites/ })).toContainText("8");
  // Edit a rate: totals and preview follow
  await page.getByText("Delhi Rd. Kasola Chowk Before Flyover").first().click();
  const rate = page.getByLabel("Rate / month");
  await rate.fill("46000");
  await expect(page.locator(".totals")).toContainText("₹4,76,000");
  await expect(page.frameLocator('iframe[title="Plan page preview"]').locator("tfoot")).toContainText("₹4,76,000*");
  // Kept in this browser
  await page.reload();
  await expect(page.locator(".totals")).toContainText("₹4,76,000");
});

test("start a new plan, add a site by hand and download the page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Start a new plan/ }).click();
  await expect(page.getByText("Add your first site")).toBeVisible();
  await page.getByRole("button", { name: "Add a site" }).first().click();
  await page.getByLabel("Location").fill("MG Road Metro");
  await page.getByLabel("Coordinates").fill(`Lat 28°28'47.6"N, Long 77°4'48.7"E`);
  await expect(page.getByText(/Reads as 28\.479889, 77\.080194/)).toBeVisible();
  await expect(page.getByLabel("Location")).toHaveValue("MG Road Metro");   // quick edits to two fields both stick
  await page.getByLabel("Width (ft)").fill("40");
  await page.getByLabel("Height (ft)").fill("20");
  await page.getByLabel("Rate / month").fill("50000");
  const f = page.frameLocator('iframe[title="Plan page preview"]');
  await expect(pins(f)).toHaveCount(1);
  await expect(f.locator("tfoot")).toContainText("₹50,000*");   // printing TBC

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download page" }).click()]);
  expect(download.suggestedFilename()).toBe("billboard-plan.html");
  const html = readFileSync((await download.path())!, "utf8");
  expect(html).toContain("MG Road Metro");
  expect(html).toMatch(/<script id="plan-data" type="application\/json">/);
});

test("open a vendor spreadsheet with its photos", async ({ page }) => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ["S.No", "Route", "Location", "Lat Long", "Size", "D.C.P.M", "Printing & Mounting"],
    [1, "Delhi Jaipur Highway", "Delhi Rd. Kasola Chowk Before Flyover", "28.135394, 76.650181", "40 x 30", "36,000", 12000],
    [2, "Delhi Jaipur Highway", "Delhi Rd – Agarwal Movers & Packers", `Lat 28°10'58.4895"N, Long 76°43'3.3067"E`, "40 x 20", "₹24,000", "8,000"],
    ["", "", "Total", "", "", "60,000", ""]
  ]), "Sites");
  const photo = readFileSync("examples/aaj-swift-nh48/photos/1.jpg");
  await page.goto("/");
  await page.locator('input[type="file"]').setInputFiles([
    { name: "vendor.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) },
    { name: "1.jpg", mimeType: "image/jpeg", buffer: photo }
  ]);
  await expect(page).toHaveURL(/#edit$/);
  const f = page.frameLocator('iframe[title="Plan page preview"]');
  await expect(pins(f)).toHaveCount(2);
  await expect(f.locator("tfoot")).toContainText("₹80,000");
  await pins(f).first().hover();
  await expect(f.locator("#card img")).toHaveCount(1);
});

test("a page downloaded from the app opens again for editing", async ({ page }) => {
  await openExample(page);
  await page.getByRole("button", { name: "Duplicate as my plan" }).click();
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Download page" }).click()]);
  const html = readFileSync((await download.path())!);
  await page.goto("/");
  page.once("dialog", d => d.accept());
  await page.locator('input[type="file"]').setInputFiles([{ name: "plan.html", mimeType: "text/html", buffer: html }]);
  await expect(page.getByRole("tab", { name: /Sites/ })).toContainText("8");
  const f = page.frameLocator('iframe[title="Plan page preview"]');
  await expect(pins(f)).toHaveCount(8);
  await expect(f.locator("tfoot")).toContainText("₹4,66,000*");
});
