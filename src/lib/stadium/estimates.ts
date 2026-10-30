/** Ham JSON'daki tahmini değerlerin listesi (rapor ve README için). */
export interface EstimateEntry {
  path: string;
  value?: number | string;
  note?: string;
  source?: string;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function elementName(el: Json, index: number): string {
  if (el && typeof el === "object" && !Array.isArray(el)) {
    const { stand, tier, id } = el;
    if (typeof stand === "string" && typeof tier === "string" && typeof id === "string") {
      return `${stand}-${tier}/${id}`;
    }
    if (typeof id === "string") return id;
  }
  return String(index);
}

/**
 * `{ "value": n, "estimate": true }` sarmalayıcılarını ve blok düzeyindeki
 * `"estimate": true` işaretlerini JSON yoluyla birlikte toplar.
 */
export function collectEstimates(raw: unknown): EstimateEntry[] {
  const out: EstimateEntry[] = [];
  const visit = (node: Json, path: string) => {
    if (Array.isArray(node)) {
      node.forEach((el, i) => visit(el, `${path}[${elementName(el, i)}]`));
      return;
    }
    if (!node || typeof node !== "object") return;
    if (node.estimate === true) {
      const value = typeof node.value === "number" || typeof node.value === "string" ? node.value : undefined;
      out.push({
        path,
        value,
        note: typeof node.note === "string" ? node.note : undefined,
        source: typeof node.source === "string" ? node.source : undefined,
      });
      if (value !== undefined) return;
    }
    for (const [key, child] of Object.entries(node)) {
      visit(child, path ? `${path}.${key}` : key);
    }
  };
  visit(raw as Json, "");
  return out;
}
