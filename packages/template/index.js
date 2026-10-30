import { readFileSync } from "node:fs";
import { renderWith } from "./render.js";

export { scriptSafeJson, renderWith, readPlanData } from "./render.js";

export const TEMPLATE_PATH = new URL("./template.html", import.meta.url);

/**
 * Build the plan page: the template with the plan data injected.
 * Photos and logos in `plan` should already be data: URIs for a self-contained file.
 * @param {object} plan  plan data in the shape described in README.md
 * @param {string} [template]  template HTML (defaults to template.html next to this file)
 * @returns {string} the complete HTML page
 */
export function renderPlan(plan, template = readFileSync(TEMPLATE_PATH, "utf8")) {
  return renderWith(plan, template);
}
