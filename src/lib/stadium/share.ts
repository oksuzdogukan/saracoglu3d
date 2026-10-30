import { categoryLabel } from "./categories";
import { seatKey, seatPath } from "./ids";
import type { StadiumModel } from "./layout";

export interface SeatParams {
  tribun: string;
  blok: string;
  sira: string;
  koltuk: string;
}

/** /koltuk/[tribun]/[blok]/[sira]/[koltuk] parametrelerini koltuk indeksine çevirir; yoksa null. */
export function resolveSeatParams(model: StadiumModel, params: SeatParams): number | null {
  const dec = (v: string) => decodeURIComponent(v).trim();
  const slug = dec(params.tribun).toLowerCase();
  const number = Number(dec(params.koltuk));
  if (!Number.isInteger(number)) return null;
  const key = seatKey(`${slug}/${dec(params.blok).toUpperCase()}`, dec(params.sira), number);
  return model.seatIndex.get(key) ?? null;
}

export function seatParams(model: StadiumModel, seat: number): SeatParams {
  const block = model.blocks[model.seats.block[seat]];
  return {
    tribun: block.slug,
    blok: block.id,
    sira: model.rows[model.seats.row[seat]].label,
    koltuk: String(model.seats.number[seat]),
  };
}

export function seatUrlPath(model: StadiumModel, seat: number): string {
  const block = model.blocks[model.seats.block[seat]];
  return seatPath(block.key, model.rows[model.seats.row[seat]].label, model.seats.number[seat]);
}

export interface SeatSummary {
  /** "Maraton Üst · E · Sıra 1 · Koltuk 16" */
  title: string;
  standName: string;
  tierName: string;
  blockId: string;
  rowLabel: string;
  number: number;
  /** Saha merkezine yatay uzaklık (m). */
  toCenter: number;
  /** Oturan birinin gözünün çime göre yüksekliği (m). */
  eyeHeight: number;
  category: string | null;
}

export function seatSummary(model: StadiumModel, seat: number): SeatSummary {
  const block = model.blocks[model.seats.block[seat]];
  const row = model.rows[model.seats.row[seat]];
  const number = model.seats.number[seat];
  return {
    title: `${block.label} · Sıra ${row.label} · Koltuk ${number}`,
    standName: model.stands[block.stand].name,
    tierName: model.tiers[block.tier].name,
    blockId: block.id,
    rowLabel: row.label,
    number,
    toCenter: Math.hypot(model.seats.x[seat], model.seats.z[seat]),
    eyeHeight: model.seats.y[seat] + model.data.defaults.eyeHeight,
    category: categoryLabel(block.category),
  };
}
