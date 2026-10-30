import type { GroupData, SiteData } from "./model.js";

// Cost rules, shared with the generated page (packages/template/template.html):
// area = W × H × qty; rent = monthly rate × days / 30; total = rent + one-time printing.
// Printing marked "extra" or "tbc" counts as 0 and makes the total "open" (shown with *).

export const area = (s: SiteData) => s.widthFt * s.heightFt * s.qty;
export const rent = (s: SiteData) => Math.round(s.ratePerMonth * s.days / 30);
export const hasPrinting = (s: SiteData): s is SiteData & { printing: number } => typeof s.printing === "number";

export function siteTotal(s: SiteData) {
  return { total: rent(s) + (hasPrinting(s) ? s.printing : 0), open: !hasPrinting(s) };
}

export interface Totals { count: number; area: number; rate: number; printing: number; total: number; open: boolean }
export interface GroupTotals extends Totals { id: string; name: string }

const empty = (): Totals => ({ count: 0, area: 0, rate: 0, printing: 0, total: 0, open: false });
const add = (t: Totals, s: SiteData) => {
  const { total, open } = siteTotal(s);
  t.count += 1; t.area += area(s); t.rate += s.ratePerMonth; t.printing += hasPrinting(s) ? s.printing : 0;
  t.total += total; t.open = t.open || open;
};

/** Subtotals per group (in group order, empty groups left out) and the grand total. `rate` sums the monthly rates. */
export function planTotals(sites: SiteData[], groups: GroupData[]): { groups: GroupTotals[]; grand: Totals } {
  const grand = empty();
  const out: GroupTotals[] = [];
  for (const g of groups) {
    const t = { id: g.id, name: g.name, ...empty() };
    for (const s of sites) if (s.group === g.id) { add(t, s); add(grand, s); }
    if (t.count) out.push(t);
  }
  return { groups: out, grand };
}
