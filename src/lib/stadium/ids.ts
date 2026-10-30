/** Link ve arama kimlikleri. Biçim: tribün-kat / blok / sıra / koltuk → "maraton-ust/A/12/7". */

export function tierSlug(standId: string, tierId: string): string {
  return `${standId}-${tierId}`;
}

export function blockKey(standId: string, tierId: string, blockId: string): string {
  return `${tierSlug(standId, tierId)}/${blockId.toUpperCase()}`;
}

export function seatKey(blockKeyValue: string, rowLabel: string, seatNumber: number): string {
  return `${blockKeyValue}/${rowLabel.toUpperCase()}/${seatNumber}`;
}

/** Aşama 3'teki paylaşım linki: /koltuk/maraton-ust/A/12/7 */
export function seatPath(blockKeyValue: string, rowLabel: string, seatNumber: number): string {
  return `/koltuk/${seatKey(blockKeyValue, rowLabel, seatNumber)}`;
}
