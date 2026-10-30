import type { AlignName, RowRuleData } from "./schema";

/** Bir sıradaki fiziksel yerler: koltuk numarası ya da boş yer (null). */
export type SeatToken = number | null;

export class NumberingError extends Error {}

/**
 * Koltuk ifadesini ayrıştırır. Virgülle ayrılmış parçalar:
 *   "7"        tek koltuk
 *   "1-24"     artan aralık,  "24-1" azalan aralık
 *   "1-49/2"   adımlı aralık (1, 3, 5, …)
 *   "_"        koltuksuz bir fiziksel yer, "_3" üç boş yer
 */
export function parseSeatSpec(spec: string): SeatToken[] {
  const tokens: SeatToken[] = [];
  const seen = new Set<number>();
  const push = (n: number) => {
    if (seen.has(n)) throw new NumberingError(`Koltuk numarası tekrar ediyor: ${n}`);
    seen.add(n);
    tokens.push(n);
  };
  for (const rawItem of spec.split(",")) {
    const item = rawItem.trim();
    if (!item) throw new NumberingError(`Boş parça: "${spec}"`);
    let m: RegExpMatchArray | null;
    if ((m = item.match(/^_(\d+)?$/))) {
      const count = m[1] ? Number(m[1]) : 1;
      for (let i = 0; i < count; i++) tokens.push(null);
    } else if ((m = item.match(/^(\d+)$/))) {
      push(Number(m[1]));
    } else if ((m = item.match(/^(\d+)-(\d+)(?:\/(\d+))?$/))) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const step = m[3] ? Number(m[3]) : 1;
      if (step < 1) throw new NumberingError(`Adım en az 1 olmalı: "${item}"`);
      if (a <= b) for (let v = a; v <= b; v += step) push(v);
      else for (let v = a; v >= b; v -= step) push(v);
    } else {
      throw new NumberingError(`Anlaşılamayan koltuk ifadesi: "${item}"`);
    }
  }
  return tokens;
}

/**
 * Sıra etiketi ifadesi: "5", "1-24", "24-1", "A-F", "1-10,12-20" ya da
 * tire/virgül içermeyen herhangi bir etiket ("1A").
 */
export function parseRowLabels(spec: string): string[] {
  const out: string[] = [];
  for (const rawItem of spec.split(",")) {
    const item = rawItem.trim();
    if (!item) throw new NumberingError(`Boş sıra parçası: "${spec}"`);
    let m: RegExpMatchArray | null;
    if ((m = item.match(/^(\d+)-(\d+)$/))) {
      const a = Number(m[1]);
      const b = Number(m[2]);
      const dir = a <= b ? 1 : -1;
      for (let v = a; dir > 0 ? v <= b : v >= b; v += dir) out.push(String(v));
    } else if ((m = item.match(/^([A-Za-z])-([A-Za-z])$/))) {
      const a = m[1].toUpperCase().charCodeAt(0);
      const b = m[2].toUpperCase().charCodeAt(0);
      const dir = a <= b ? 1 : -1;
      for (let v = a; dir > 0 ? v <= b : v >= b; v += dir) out.push(String.fromCharCode(v));
    } else if (!/[-,\s]/.test(item)) {
      out.push(item);
    } else {
      throw new NumberingError(`Anlaşılamayan sıra ifadesi: "${item}"`);
    }
  }
  return out;
}

export interface ExpandedRow {
  label: string;
  /** Önden arkaya fiziksel sıra indeksi (0 = en ön). */
  phys: number;
  tokens: SeatToken[] | "auto";
  shift: number;
  align?: AlignName;
}

/** Sıra kurallarını tek tek sıralara açar; `gap` kuralları fiziksel indeksi ilerletir. */
export function expandRows(rules: RowRuleData[]): { rows: ExpandedRow[]; physCount: number } {
  const rows: ExpandedRow[] = [];
  const labels = new Set<string>();
  let phys = 0;
  for (const rule of rules) {
    if ("gap" in rule) {
      phys += rule.gap;
      continue;
    }
    const tokens = rule.seats.trim() === "auto" ? "auto" : parseSeatSpec(rule.seats);
    for (const label of parseRowLabels(rule.rows)) {
      if (labels.has(label)) throw new NumberingError(`Sıra etiketi tekrar ediyor: ${label}`);
      labels.add(label);
      rows.push({ label, phys, tokens, shift: rule.shift ?? 0, align: rule.align });
      phys += 1;
    }
  }
  return { rows, physCount: phys };
}
