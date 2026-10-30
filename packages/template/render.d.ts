export function scriptSafeJson(data: unknown): string;
export function renderWith(plan: { title?: string } & Record<string, unknown>, template: string): string;
export function readPlanData(html: string): Record<string, unknown> | null;
