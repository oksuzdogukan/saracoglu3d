import { z } from "zod";
import { collectEstimates, type EstimateEntry } from "./estimates";
import { buildStadiumModel, type Issue, type StadiumModel } from "./layout";
import { StadiumSchema } from "./schema";

export class StadiumDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StadiumDataError";
  }
}

export interface LoadResult {
  model: StadiumModel | null;
  estimates: EstimateEntry[];
  /** Şema hataları (okunabilir metin) — varsa model üretilmez. */
  schemaError: string | null;
  issues: Issue[];
}

/** Ham JSON'u doğrular ve hesaplanmış modeli üretir; hata fırlatmaz. */
export function analyzeStadium(raw: unknown): LoadResult {
  const estimates = collectEstimates(raw);
  const parsed = StadiumSchema.safeParse(raw);
  if (!parsed.success) {
    return { model: null, estimates, schemaError: z.prettifyError(parsed.error), issues: [] };
  }
  const model = buildStadiumModel(parsed.data);
  return { model, estimates, schemaError: null, issues: model.issues };
}

/** Uygulama için: hata varsa açıklayıcı bir mesajla durur, uyarıları döndürür. */
export function loadStadium(raw: unknown): StadiumModel {
  const result = analyzeStadium(raw);
  if (result.schemaError) {
    throw new StadiumDataError(`stadium.json şemaya uymuyor:\n${result.schemaError}`);
  }
  const errors = result.issues.filter((i) => i.level === "error");
  if (errors.length > 0) {
    throw new StadiumDataError(
      `stadium.json'da ${errors.length} hata var:\n${errors.map((e) => `  ✖ ${e.path}: ${e.message}`).join("\n")}`,
    );
  }
  return result.model!;
}
