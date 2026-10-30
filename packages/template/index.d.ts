/** Path of template.html next to this module. */
export const TEMPLATE_PATH: URL;
/** JSON that is safe inside a <script type="application/json"> block. */
export function scriptSafeJson(data: unknown): string;
/** The template with the plan data and title filled in. */
export function renderPlan(plan: { title?: string } & Record<string, unknown>, template?: string): string;
