/** Path of template.html next to this module. */
export const TEMPLATE_PATH: URL;
/** JSON that is safe inside a <script type="application/json"> block. */
export function scriptSafeJson(data: unknown): string;
/** The template with the plan data and title filled in. */
export function renderPlan(plan: { title?: string } & Record<string, unknown>, template?: string): string;
/** Fill the given template HTML with plan data (browser-safe). */
export function renderWith(plan: { title?: string } & Record<string, unknown>, template: string): string;
/** The plan data inside a page built by Billboard Planner, or null. */
export function readPlanData(html: string): Record<string, unknown> | null;
