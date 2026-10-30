/** Blok kategorilerinin görünen adları ve 2D haritadaki dolgu renkleri. Tanımsız kategori adıyla gösterilir. */
export const CATEGORY_LABELS: Record<string, string> = {
  misafir: "Misafir",
  "misafir-kismen": "Kısmen misafir",
  vip: "VIP",
  basin: "Basın tribünü (arka sıralar)",
};

export const CATEGORY_FILLS: Record<string, string> = {
  misafir: "#2b2d31",
  "misafir-kismen": "#5c5f66",
};

export function categoryLabel(category: string | undefined): string | null {
  if (!category) return null;
  return CATEGORY_LABELS[category] ?? category;
}
