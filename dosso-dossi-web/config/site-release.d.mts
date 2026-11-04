export function siteRelease(environment?: Record<string, string | undefined>): { public: boolean; origin: string };
export const publicPagePaths: string[];
export const privatePaths: string[];
export function publishedProductPaths(products: { status: string; slug: string; variants: { active: boolean }[] }[]): string[];
export function localizedPath(path: string, locale: "tr" | "en"): string;
export function securityHeaders(development?: boolean): { key: string; value: string }[];
