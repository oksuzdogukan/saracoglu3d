import { describe, expect, it } from "vitest";
import raw from "../../data/stadium.json";
import { loadStadium } from "./load";
import { buildPlan, planToSvg } from "./plan";
import { resolveSeatParams, seatParams, seatSummary, seatUrlPath } from "./share";

const model = loadStadium(raw);

describe("paylaşım linkleri", () => {
  it("link parametrelerini koltuğa çevirir ve geri üretir", () => {
    const seat = resolveSeatParams(model, { tribun: "maraton-ust", blok: "e", sira: "1", koltuk: "16" });
    expect(seat).not.toBeNull();
    expect(seatParams(model, seat!)).toEqual({ tribun: "maraton-ust", blok: "E", sira: "1", koltuk: "16" });
    expect(seatUrlPath(model, seat!)).toBe("/koltuk/maraton-ust/E/1/16");
    expect(seatSummary(model, seat!).title).toBe("Maraton Üst · E · Sıra 1 · Koltuk 16");
  });

  it("olmayan koltukları reddeder", () => {
    expect(resolveSeatParams(model, { tribun: "maraton-ust", blok: "E", sira: "99", koltuk: "1" })).toBeNull();
    expect(resolveSeatParams(model, { tribun: "besiktas-alt", blok: "A", sira: "1", koltuk: "1" })).toBeNull();
    expect(resolveSeatParams(model, { tribun: "maraton-ust", blok: "E", sira: "1", koltuk: "abc" })).toBeNull();
  });

  it("önizleme SVG'si geçerli bir svg ve işaret içerir", () => {
    const svg = planToSvg(buildPlan(model), { width: 600, height: 500, highlight: 0, marker: { x: 1, z: 2 } });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain("<circle");
    expect(svg.match(/<path/g)!.length).toBe(model.blocks.length + 1);
  });
});
