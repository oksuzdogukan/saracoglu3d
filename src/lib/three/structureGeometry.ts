import { BufferGeometry, Color } from "three";
import type { StructureModel } from "../stadium/structures";
import { MeshWriter } from "./meshWriter";

/** Halkaya bağlı ya da mutlak konumlu yapılar (kulübe, tünel, ekran, kolon). */
export function buildStructureGeometry(list: StructureModel[]): BufferGeometry {
  const w = new MeshWriter();
  for (const st of list) {
    const color = new Color(st.color);
    if (st.type === "box") {
      w.box(st.x, st.y, st.z, st.size, st.rotationY, color, st.frontColor ? new Color(st.frontColor) : color);
    } else {
      w.prism(st.x, st.y, st.z, st.size[0] / 2, st.size[1], color);
    }
  }
  return w.toGeometry();
}
