import { seatKey } from "./ids";
import type { BlockModel, StadiumModel } from "./layout";

export interface SeatQuery {
  /** Eşleşen bloklar (tek eşleşmede block dolu). */
  blocks: number[];
  block: number | null;
  rowLabel: string | null;
  seatNumber: number | null;
  /** Koltuk tam ve geçerliyse indeksi. */
  seat: number | null;
  /** Eksik ya da hatalı kısım için Türkçe ipucu; tam eşleşmede boş. */
  message: string;
}

/** Türkçe karakterleri sadeleştirip küçük harfe çevirir: "Üst" → "ust", "SIRA" → "sira". */
export function normalizeText(text: string): string {
  return text
    .toLocaleLowerCase("tr-TR")
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/[ıi̇]/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

const ROW_WORDS = new Set(["sira", "sirasi"]);
const SEAT_WORDS = new Set(["koltuk", "koltugu", "numara", "numarali", "no"]);
const FILLER = new Set(["blok", "blogu", "tribun", "tribunu", "kat", "kati"]);

/**
 * Serbest metinden koltuk arar. Anlaşılan biçimler:
 *   "Maraton Üst A 12 7", "maraton üst a blok sıra 12 koltuk 7",
 *   "12. sıra 7 numara kuzey k", "maraton-ust/A/12/7"
 * Tribün ya da kat yazılmazsa uyan tüm bloklar aday olur.
 */
export function searchSeat(model: StadiumModel, text: string): SeatQuery {
  const empty: SeatQuery = { blocks: [], block: null, rowLabel: null, seatNumber: null, seat: null, message: "" };
  const q = normalizeText(text).trim();
  if (!q) return empty;

  const path = q.match(/^([a-z-]+)\/([a-z0-9]+)(?:\/([a-z0-9]+))?(?:\/(\d+))?$/);
  if (path) {
    const [, slug, blockId, row, seat] = path;
    const blocks = model.blocks.filter((b) => b.slug === slug && b.id === blockId.toUpperCase()).map((b) => b.index);
    return resolve(model, blocks, row ? row.toUpperCase() : null, seat ? Number(seat) : null);
  }

  // Sondaki nokta sıra sayısını belirtir ("12. sıra"); değer karşılaştırmalarında atılır
  const raw = q.match(/[a-z0-9]+\.?/g) ?? [];
  const ordinal = raw.map((t) => t.endsWith("."));
  const tokens = raw.map((t) => t.replace(/\.$/, ""));
  const used = new Array(tokens.length).fill(false);

  let standIds: Set<string> | null = null;
  for (const stand of model.stands) {
    const parts = normalizeText(stand.name).split(/\s+/);
    for (let i = 0; i + parts.length <= tokens.length; i++) {
      const joined = tokens.slice(i, i + parts.length).join(" ") === parts.join(" ");
      const compact = tokens[i] === parts.join("") || tokens[i] === stand.id.replace(/-/g, "");
      if (joined || compact) {
        const n = joined ? parts.length : 1;
        for (let k = i; k < i + n; k++) used[k] = true;
        (standIds ??= new Set()).add(stand.id);
        break;
      }
    }
  }

  let tierId: string | null = null;
  tokens.forEach((t, i) => {
    if (used[i] || tierId) return;
    const tier = model.tiers.find((x) => x.id === t || normalizeText(x.name) === t);
    if (tier) {
      tierId = tier.id;
      used[i] = true;
    }
  });

  let rowLabel: string | null = null;
  let seatNumber: number | null = null;
  let blockId: string | null = null;
  const free = (j: number, pattern: RegExp) => j >= 0 && j < tokens.length && !used[j] && pattern.test(tokens[j]);
  /**
   * Anahtar kelimenin değeri: önce "12. sıra" (önünde noktalı sayı), sonra
   * "sıra 12" (arkasında), en son "7 numara" (önünde, noktasız).
   */
  const take = (i: number, pattern: RegExp): string | null => {
    const order = ordinal[i - 1] ? [i - 1, i + 1] : [i + 1, i - 1];
    for (const j of order) {
      if (free(j, pattern)) {
        used[j] = true;
        return tokens[j];
      }
    }
    return null;
  };
  tokens.forEach((t, i) => {
    if (used[i]) return;
    if (ROW_WORDS.has(t)) {
      used[i] = true;
      rowLabel ??= take(i, /^(\d+|[a-z]{1,2})$/);
    } else if (SEAT_WORDS.has(t)) {
      used[i] = true;
      const v = take(i, /^\d+$/);
      if (v && seatNumber === null) seatNumber = Number(v);
    } else if (FILLER.has(t)) {
      used[i] = true;
      if (t.startsWith("blo")) blockId ??= take(i, /^[a-z]{1,2}$/);
    }
  });

  tokens.forEach((t, i) => {
    if (used[i]) return;
    if (/^\d+$/.test(t)) {
      if (rowLabel === null) rowLabel = t;
      else if (seatNumber === null) seatNumber = Number(t);
      used[i] = true;
    } else if (/^[a-z]{1,2}$/.test(t) && blockId === null) {
      blockId = t;
      used[i] = true;
    }
  });

  const unknown = tokens.filter((t, i) => !used[i] && /^[a-z]{3,}$/.test(t));
  if (unknown.length && !standIds) {
    const names = model.stands.map((s) => s.name).join(", ");
    return { ...empty, message: `“${unknown[0]}” anlaşılamadı. Tribün olarak ${names} yazabilirsiniz.` };
  }

  const candidates = model.blocks.filter(
    (b) =>
      (!standIds || standIds.has(b.standId)) &&
      (!tierId || b.tierId === tierId) &&
      (!blockId || b.id === (blockId as string).toUpperCase()),
  );
  if (!standIds && !tierId && !blockId) return { ...empty, message: "Tribün ve blok yazın, örneğin “Maraton Üst A 12 7”." };
  return resolve(
    model,
    candidates.map((b) => b.index),
    rowLabel ? (rowLabel as string).toUpperCase() : null,
    seatNumber,
  );
}

function resolve(model: StadiumModel, blocks: number[], rowLabel: string | null, seatNumber: number | null): SeatQuery {
  const base: SeatQuery = { blocks, block: null, rowLabel, seatNumber, seat: null, message: "" };
  if (blocks.length === 0) return { ...base, message: "Böyle bir blok bulunamadı." };
  if (blocks.length > 1) return { ...base, message: `${blocks.length} blok eşleşti; birini seçin ya da tribün ve katı ekleyin.` };
  const block = model.blocks[blocks[0]];
  const rows = blockRows(model, block);
  const result = { ...base, block: block.index };
  const rowRange = `${rows[0]?.label}–${rows.at(-1)?.label}`;
  if (rowLabel === null) return { ...result, message: `Sıra yazın (${rowRange}).` };
  const row = rows.find((r) => r.label === rowLabel);
  if (!row) return { ...result, message: `Bu blokta ${rowLabel}. sıra yok (sıralar ${rowRange}).` };
  const numbers = rowNumbers(model, row.seatStart, row.seatCount);
  const seatRange = `${numbers[0]}–${numbers.at(-1)}`;
  if (seatNumber === null) return { ...result, message: `Koltuk numarası yazın (${seatRange}).` };
  const seat = model.seatIndex.get(seatKey(block.key, row.label, seatNumber));
  if (seat === undefined) return { ...result, message: `${row.label}. sırada ${seatNumber} numaralı koltuk yok (${seatRange}).` };
  return { ...result, seat };
}

export function blockRows(model: StadiumModel, block: BlockModel) {
  return model.rows.slice(block.rowStart, block.rowStart + block.rowCount);
}

/** Bir sıradaki koltuk numaraları, küçükten büyüğe. */
export function rowNumbers(model: StadiumModel, seatStart: number, seatCount: number): number[] {
  return Array.from(model.seats.number.subarray(seatStart, seatStart + seatCount)).sort((a, b) => a - b);
}
