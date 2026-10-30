import { BoxGeometry, BufferGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { SeatArrays } from "../stadium/layout";

/** Koltuk modelinin tasarlandığı koltuk aralığı; örnekler bu orana göre ölçeklenir. */
const MODEL_PITCH = 0.5;

/**
 * Yakın koltuk, boş haliyle: oturak yukarı katlanmış, sırtlığa paralel
 * (~32 üçgen). Yerel +z sahaya bakar, orijin basamak zeminindeki koltuk merkezidir.
 */
export function createNearSeatGeometry(): BufferGeometry {
  const parts = [
    // Sırtlık
    box(0.44, 0.42, 0.05, 0, 0.4, -0.215),
    // Katlanmış oturak: menteşe ~0,4 m'de, sırtlığın hemen önünde dik
    box(0.42, 0.38, 0.07, 0, 0.41, -0.13),
    // Ayak
    box(0.07, 0.41, 0.07, 0, 0, -0.17),
  ];
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return withKind(merged);
}

/**
 * Uzak koltuk: katlanmış oturağın ön yüzü kadar tek dörtgen (2 üçgen). Yakın
 * modelin içinde kalır, böylece ikisi üst üste çizilince titreşmez.
 */
export function createFarSeatGeometry(): BufferGeometry {
  const g = new BufferGeometry();
  const w = 0.2;
  // prettier-ignore
  const positions = [
    -w, 0.42, -0.13,  w, 0.42, -0.13,  w, 0.8, -0.13,  -w, 0.8, -0.13,
  ];
  g.setAttribute("position", new Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  return withKind(g);
}

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _p = new Vector3();
const _s = new Vector3();

/** i'nci koltuğun örnek matrisi. */
export function seatMatrix(seats: SeatArrays, i: number, out = _m): Matrix4 {
  _p.set(seats.x[i], seats.y[i], seats.z[i]);
  _q.setFromEuler(_e.set(0, seats.yaw[i], 0));
  _s.set(seats.width[i] / MODEL_PITCH, 1, 1);
  return out.compose(_p, _q, _s);
}

/** Taban kotu y olan kutu. */
function box(w: number, h: number, d: number, x: number, y: number, z: number): BufferGeometry {
  const g = new BoxGeometry(w, h, d);
  g.deleteAttribute("uv");
  g.translate(x, y + h / 2, z);
  return g;
}

function withKind(g: BufferGeometry): BufferGeometry {
  const count = g.getAttribute("position").count;
  g.setAttribute("aKind", new Float32BufferAttribute(new Float32Array(count).fill(1), 1));
  return g;
}
