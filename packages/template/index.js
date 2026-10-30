import { readFileSync } from "node:fs";

export const TEMPLATE_PATH = new URL("./template.html", import.meta.url);

const escapeHtml = t => String(t).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

// JSON that is safe inside <script type="application/json">: no "</script>", no HTML comments, no JS line separators.
export const scriptSafeJson = data => JSON.stringify(data)
  .replace(/</g, "\\u003c")
  .replace(/\u2028/g, "\\u2028")
  .replace(/\u2029/g, "\\u2029");

const fillOnce = (html, token, value) => {
  const parts = html.split(token);
  if (parts.length !== 2) throw new Error(`Template must contain ${token} exactly once (found ${parts.length - 1})`);
  return parts.join(value);
};

/**
 * Build the plan page: the template with the plan data injected.
 * Photos and logos in `plan` should already be data: URIs for a self-contained file.
 * @param {object} plan  plan data in the shape described in README.md
 * @param {string} [template]  template HTML (defaults to template.html next to this file)
 * @returns {string} the complete HTML page
 */
export function renderPlan(plan, template = readFileSync(TEMPLATE_PATH, "utf8")) {
  const html = fillOnce(template, "__PLAN_TITLE__", escapeHtml(plan.title || "Billboard Plan"));
  return fillOnce(html, "__PLAN_DATA__", scriptSafeJson(plan));
}
