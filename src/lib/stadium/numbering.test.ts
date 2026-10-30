import { describe, expect, it } from "vitest";
import { expandRows, NumberingError, parseRowLabels, parseSeatSpec } from "./numbering";

describe("parseSeatSpec", () => {
  it("aralık, ters aralık, adım ve boş yerleri anlar", () => {
    expect(parseSeatSpec("1-4")).toEqual([1, 2, 3, 4]);
    expect(parseSeatSpec("4-1")).toEqual([4, 3, 2, 1]);
    expect(parseSeatSpec("1-9/2")).toEqual([1, 3, 5, 7, 9]);
    expect(parseSeatSpec("1-2,_,_2, 3")).toEqual([1, 2, null, null, null, 3]);
    expect(parseSeatSpec("1-12, 14-15")).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15]);
  });

  it("hatalı ifadeleri ve tekrarları reddeder", () => {
    expect(() => parseSeatSpec("1-3,3")).toThrow(NumberingError);
    expect(() => parseSeatSpec("a-b")).toThrow(NumberingError);
    expect(() => parseSeatSpec("1,,2")).toThrow(NumberingError);
    expect(() => parseSeatSpec("1-5/0")).toThrow(NumberingError);
  });
});

describe("parseRowLabels", () => {
  it("sayı ve harf aralıklarını açar", () => {
    expect(parseRowLabels("1-3")).toEqual(["1", "2", "3"]);
    expect(parseRowLabels("3-1")).toEqual(["3", "2", "1"]);
    expect(parseRowLabels("a-c")).toEqual(["A", "B", "C"]);
    expect(parseRowLabels("1-2,5,1A")).toEqual(["1", "2", "5", "1A"]);
  });
});

describe("expandRows", () => {
  it("gap kuralı fiziksel sırayı ilerletir", () => {
    const { rows, physCount } = expandRows([
      { rows: "1-2", seats: "1-10" },
      { gap: 1 },
      { rows: "3", seats: "auto", shift: -1 },
    ]);
    expect(rows.map((r) => [r.label, r.phys])).toEqual([
      ["1", 0],
      ["2", 1],
      ["3", 3],
    ]);
    expect(rows[2].tokens).toBe("auto");
    expect(rows[2].shift).toBe(-1);
    expect(physCount).toBe(4);
  });

  it("tekrar eden sıra etiketini reddeder", () => {
    expect(() => expandRows([{ rows: "1-3", seats: "auto" }, { rows: "3", seats: "auto" }])).toThrow(NumberingError);
  });
});
