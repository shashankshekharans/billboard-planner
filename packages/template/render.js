// Browser-safe part of the renderer: no file access. index.js adds the default template for Node.

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
 * Fill a template with plan data.
 * @param {object} plan  plan data in the shape described in README.md
 * @param {string} template  template HTML
 * @returns {string} the complete HTML page
 */
export function renderWith(plan, template) {
  const html = fillOnce(template, "__PLAN_TITLE__", escapeHtml(plan.title || "Billboard Plan"));
  return fillOnce(html, "__PLAN_DATA__", scriptSafeJson(plan));
}

/** The plan data inside a page built by Billboard Planner, or null if there is none. */
export function readPlanData(html) {
  const m = html.match(/<script id="plan-data" type="application\/json">([\s\S]*?)<\/script>/);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}
