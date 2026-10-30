import type { StandModel, TierModel } from "./layout";
import type { StructureData } from "./schema";

export interface StructureModel {
  id: string;
  name?: string;
  type: "box" | "column";
  /** Taban merkezi. */
  x: number;
  y: number;
  z: number;
  /** Y ekseni etrafında dönüş (radyan). Yerel +z sahaya bakan yüzdür. */
  rotationY: number;
  /** Kutu: genişlik, yükseklik, derinlik. Kolon: çap, yükseklik, çap. */
  size: [number, number, number];
  color: string;
  frontColor?: string;
  estimate: boolean;
}

/** Yapıları mutlak koordinatlara çevirir; halkaya bağlı olanlar eğrinin normaline göre döner. */
export function placeStructures(
  list: StructureData[],
  tiers: Map<string, TierModel>,
  stands: Map<string, StandModel>,
  error: (path: string, message: string) => void,
): StructureModel[] {
  const out: StructureModel[] = [];
  for (const st of list) {
    let x: number;
    let y: number;
    let z: number;
    let rotationY = (st.rotationY * Math.PI) / 180;
    if (st.at) {
      const tier = tiers.get(st.at.tier);
      const stand = stands.get(st.at.stand);
      if (!tier || !stand) {
        error(`structures[${st.id}]`, "Bağlı olduğu kat ya da tribün kullanılamıyor");
        continue;
      }
      const s = tier.ring.sideCenters[stand.side] + st.at.u;
      const p = tier.ring.point(s, st.at.d);
      const n = tier.ring.normal(s);
      x = p.x;
      y = st.at.y;
      z = p.z;
      // Yerel +z, içe (sahaya) doğru normal
      rotationY += Math.atan2(-n.x, -n.z);
    } else {
      [x, y, z] = st.position!;
    }
    const size: [number, number, number] =
      st.type === "box" ? [st.size[0], st.size[1], st.size[2]] : [st.radius * 2, st.height, st.radius * 2];
    out.push({
      id: st.id,
      name: st.name,
      type: st.type,
      x,
      y,
      z,
      rotationY,
      size,
      color: st.color,
      frontColor: st.type === "box" ? st.frontColor : undefined,
      estimate: st.estimate === true,
    });
  }
  return out;
}
