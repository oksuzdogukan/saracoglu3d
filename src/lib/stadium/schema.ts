import { z } from "zod";

/**
 * stadium.json şeması.
 *
 * Sayısal ölçüler iki biçimde yazılabilir:
 *   - düz sayı (doğrulanmış değer):           "tread": 0.8
 *   - tahmini değer sarmalayıcısı:             "tread": { "value": 0.8, "estimate": true, "note": "..." }
 * Ayrıştırma sonrasında ikisi de düz sayıya dönüşür; tahmini olanlar
 * `collectEstimates` ile ayrıca listelenir.
 */
export const Measured = z
  .union([
    z.number(),
    z.strictObject({
      value: z.number(),
      estimate: z.boolean().optional(),
      note: z.string().optional(),
      source: z.string().optional(),
    }),
  ])
  .transform((v) => (typeof v === "number" ? v : v.value));

/** Metin değerli tahmin sarmalayıcısı (ör. sıra aralığı "7-26"). */
const MeasuredText = z
  .union([
    z.string(),
    z.strictObject({ value: z.string(), estimate: z.boolean().optional(), note: z.string().optional(), source: z.string().optional() }),
  ])
  .transform((v) => (typeof v === "string" ? v : v.value));

const Positive = Measured.pipe(z.number().positive());
const NonNegative = Measured.pipe(z.number().nonnegative());
const Count = Measured.pipe(z.number().int().positive());

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Renk #rrggbb biçiminde olmalı");
const Slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Küçük harf, rakam ve tire kullanın");

export const Side = z.enum(["top", "right", "bottom", "left"]);
export const SeatsFrom = z.enum(["left", "right"]);
export const Align = z.enum(["start", "center", "end"]);

const Riser = z.strictObject({ first: Positive, last: Positive });

const Profile = z.strictObject({
  frontOffset: NonNegative.default(0),
  frontHeight: Measured,
  rows: Count,
  tread: Positive,
  riser: Riser,
});

const ProfileOverride = z.strictObject({
  frontOffset: NonNegative.optional(),
  frontHeight: Measured.optional(),
  rows: Count.optional(),
  tread: Positive.optional(),
  riser: Riser.optional(),
});

const Ring = z.strictObject({
  halfX: Positive,
  halfZ: Positive,
  chamfer: NonNegative,
  fillet: Positive,
});

const TierStructure = z.strictObject({
  fasciaDepth: NonNegative,
  railHeight: NonNegative,
  backWallTop: Measured,
  underside: z.boolean(),
  fasciaColor: Hex,
  backWallColor: Hex,
  /** Arka duvarın üstten aşağı renk bantları (loca katları, reklam bandı); kalan kısım backWallColor. */
  backWallBands: z.array(z.strictObject({ height: Positive, color: Hex })).optional(),
});

const Tier = z.strictObject({
  id: Slug,
  name: z.string().min(1),
  ring: Ring,
  profile: Profile,
  structure: TierStructure,
});

const StandTier = z.strictObject({ seatColor: Hex, aisleColor: Hex });

const Stand = z.strictObject({
  id: Slug,
  name: z.string().min(1),
  side: Side,
  tiers: z.record(z.string(), StandTier),
});

const RowRule = z.union([
  z.strictObject({
    rows: z.string().min(1),
    seats: z.string().min(1),
    shift: z.number().optional(),
    align: Align.optional(),
  }),
  z.strictObject({ gap: z.number().int().positive() }),
]);

const Block = z.strictObject({
  stand: z.string(),
  tier: z.string(),
  id: z.string().regex(/^[A-Za-z0-9]+$/, "Blok kodu harf/rakam olmalı"),
  from: Measured,
  to: Measured,
  estimate: z.boolean().optional(),
  note: z.string().optional(),
  category: z.string().optional(),
  seatsFrom: SeatsFrom.optional(),
  align: Align.optional(),
  seatWidth: Positive.optional(),
  seatColor: Hex.optional(),
  profile: ProfileOverride.optional(),
  rows: z.array(RowRule).min(1),
});

/**
 * Koltuklarla yazılan yazı (ör. üst kattaki FENERBAHÇE). Yazı tribün boyunca
 * from→to (tribün ortasından metre, saat yönü) ve verilen fiziksel sıralar
 * arasına yayılır; karşı tribünden bakınca soldan sağa okunur.
 */
const SeatPattern = z.strictObject({
  id: Slug,
  stand: z.string(),
  tier: z.string(),
  text: z.string().min(1),
  color: Hex,
  from: Measured,
  to: Measured,
  rows: MeasuredText,
});

const Vec3 = z.tuple([Measured, Measured, Measured]);

/**
 * Yapının konumu: ya mutlak (position = taban merkezi [x, y, z]) ya da bir
 * kat halkasına bağlı (at): tribün ortasından u metre, ön eğriden d metre
 * dışarı (negatif = sahaya doğru), y = taban kotu. Halkaya bağlı yapılar
 * eğriye göre döner ve tribün ölçüleri değişince onunla birlikte taşınır.
 */
const RingAnchor = z.strictObject({ tier: z.string(), stand: z.string(), u: Measured, d: Measured, y: Measured });

const structureBase = {
  id: Slug,
  name: z.string().optional(),
  position: Vec3.optional(),
  at: RingAnchor.optional(),
  rotationY: Measured.default(0),
  color: Hex,
  estimate: z.boolean().optional(),
  note: z.string().optional(),
};

const Structure = z.discriminatedUnion("type", [
  z.strictObject({
    ...structureBase,
    type: z.literal("box"),
    /** [genişlik (yatay/teğet), yükseklik, derinlik (sahaya doğru)] */
    size: Vec3,
    /** Sahaya bakan yüzün rengi (ekranlar için). */
    frontColor: Hex.optional(),
  }),
  z.strictObject({
    ...structureBase,
    type: z.literal("column"),
    radius: Positive,
    height: Positive,
  }),
]);

const Truss = z.strictObject({
  id: Slug,
  /** Hangi kenara paralel: Maraton top, Spor Toto right, Fenerium bottom, Kuzey left. */
  side: Side,
  /** Saha merkezinden kirişin eksenine uzaklık (m). */
  distance: Positive,
  /** Kenar boyunca, tribün ortasından saat yönünde başlangıç/bitiş (m). */
  from: Measured,
  to: Measured,
  /** Çatı yüzeyinden üst başlığa yükseklik ve çapraz aralığı (m). */
  height: Positive,
  panel: Positive,
});

const Roof = z.strictObject({
  /** Çatının sahaya bakan iç kenarı ve dış kenarı (kat halkalarıyla aynı biçim). */
  inner: Ring,
  outer: Ring,
  innerHeight: Measured,
  outerHeight: Measured,
  /** Ön ve dış kenardaki alın yüksekliği. */
  edgeDepth: Positive,
  outerEdgeDepth: Positive,
  color: Hex,
  ribs: z.strictObject({ spacing: Positive, depth: Positive, width: Positive, color: Hex }),
  catwalk: z.strictObject({ offset: Measured, drop: Positive, size: Positive, color: Hex }).optional(),
  trusses: z.array(Truss).default([]),
  trussMember: Positive,
  trussColor: Hex,
});

const Pitch = z.strictObject({
  length: Positive,
  width: Positive,
  lineWidth: Positive,
  mowStripes: z.number().int().positive(),
  markings: z.strictObject({
    centerCircleRadius: Positive,
    penaltyAreaDepth: Positive,
    penaltyAreaWidth: Positive,
    goalAreaDepth: Positive,
    goalAreaWidth: Positive,
    penaltySpotDistance: Positive,
    cornerArcRadius: Positive,
    spotRadius: Positive,
  }),
  goal: z.strictObject({
    width: Positive,
    height: Positive,
    postDiameter: Positive,
    netDepthBottom: Positive,
    netDepthTop: Positive,
  }),
  adBoards: z.strictObject({
    height: Positive,
    offsetSides: Positive,
    offsetEnds: Positive,
    color: Hex,
  }),
});

const Colors = z.strictObject({
  grassLight: Hex,
  grassDark: Hex,
  line: Hex,
  ground: Hex,
  concrete: Hex,
  riser: Hex,
  skyTop: Hex,
  skyHorizon: Hex,
});

const Defaults = z.strictObject({
  seatWidth: Positive,
  seatOffset: Positive,
  seatsFrom: SeatsFrom,
  align: Align,
  maxAisleWidth: Positive,
  eyeHeight: Positive,
  standingEyeHeight: Positive,
});

const Meta = z.strictObject({
  name: z.string(),
  capacity: z.number().int().positive(),
  northAngle: Measured,
  note: z.string().optional(),
});

export const StadiumSchema = z
  .strictObject({
    $comment: z.string().optional(),
    schemaVersion: z.literal(1),
    meta: Meta,
    colors: Colors,
    defaults: Defaults,
    pitch: Pitch,
    tiers: z.array(Tier).min(1),
    stands: z.array(Stand).min(1),
    blocks: z.array(Block),
    seatPatterns: z.array(SeatPattern).default([]),
    roof: Roof.optional(),
    structures: z.array(Structure).default([]),
  })
  .superRefine((data, ctx) => {
    const tierIds = new Set<string>();
    data.tiers.forEach((t, i) => {
      if (tierIds.has(t.id)) ctx.addIssue({ code: "custom", path: ["tiers", i, "id"], message: `Kat kimliği tekrar ediyor: ${t.id}` });
      tierIds.add(t.id);
    });
    const stands = new Map<string, (typeof data.stands)[number]>();
    data.stands.forEach((s, i) => {
      if (stands.has(s.id)) ctx.addIssue({ code: "custom", path: ["stands", i, "id"], message: `Tribün kimliği tekrar ediyor: ${s.id}` });
      stands.set(s.id, s);
      for (const tierId of Object.keys(s.tiers)) {
        if (!tierIds.has(tierId)) {
          ctx.addIssue({ code: "custom", path: ["stands", i, "tiers", tierId], message: `Tanımsız kat: ${tierId}` });
        }
      }
    });
    const keys = new Set<string>();
    data.blocks.forEach((b, i) => {
      const stand = stands.get(b.stand);
      if (!stand) {
        ctx.addIssue({ code: "custom", path: ["blocks", i, "stand"], message: `Tanımsız tribün: ${b.stand}` });
      } else if (!stand.tiers[b.tier]) {
        ctx.addIssue({ code: "custom", path: ["blocks", i, "tier"], message: `${b.stand} tribününde "${b.tier}" katı tanımlı değil` });
      }
      const key = `${b.stand}-${b.tier}/${b.id}`;
      if (keys.has(key)) ctx.addIssue({ code: "custom", path: ["blocks", i, "id"], message: `Blok tekrar ediyor: ${key}` });
      keys.add(key);
      if (b.to <= b.from) {
        ctx.addIssue({ code: "custom", path: ["blocks", i, "to"], message: `"to" (${b.to}) "from" (${b.from}) değerinden büyük olmalı` });
      }
    });
    const structureIds = new Set<string>();
    data.structures.forEach((st, i) => {
      if (structureIds.has(st.id)) ctx.addIssue({ code: "custom", path: ["structures", i, "id"], message: `Yapı kimliği tekrar ediyor: ${st.id}` });
      structureIds.add(st.id);
      if (!st.position === !st.at) {
        ctx.addIssue({ code: "custom", path: ["structures", i], message: "Yapı için ya \"position\" ya da \"at\" verin (yalnızca biri)" });
      }
      if (st.at) {
        if (!tierIds.has(st.at.tier)) ctx.addIssue({ code: "custom", path: ["structures", i, "at", "tier"], message: `Tanımsız kat: ${st.at.tier}` });
        if (!stands.has(st.at.stand)) ctx.addIssue({ code: "custom", path: ["structures", i, "at", "stand"], message: `Tanımsız tribün: ${st.at.stand}` });
      }
    });
  });

export type StadiumInput = z.input<typeof StadiumSchema>;
export type StadiumData = z.output<typeof StadiumSchema>;
export type TierData = StadiumData["tiers"][number];
export type StandData = StadiumData["stands"][number];
export type BlockData = StadiumData["blocks"][number];
export type RowRuleData = BlockData["rows"][number];
export type PitchData = StadiumData["pitch"];
export type RoofData = NonNullable<StadiumData["roof"]>;
export type SeatPatternData = StadiumData["seatPatterns"][number];
export type StructureData = StadiumData["structures"][number];
export type RingData = TierData["ring"];
export type SideName = z.infer<typeof Side>;
export type AlignName = z.infer<typeof Align>;
export type SeatsFromName = z.infer<typeof SeatsFrom>;
