import { BufferGeometry, Color, Float32BufferAttribute, Uint32BufferAttribute } from "three";

export type V3 = [number, number, number];

/**
 * Düz yüzlerden BufferGeometry biriktirir. Her yüz için istenen normal
 * yönü verilir; sarım (winding) buna göre çevrilir, böylece FrontSide
 * malzemeyle doğru taraftan görünür.
 *
 * Ek öznitelikler: aBlock (vurgu için blok indeksi, -1 = blok dışı),
 * aKind (0 = uzaktan koltuk rengine dönen basamak yüzeyi, 1 = diğer).
 */
export class MeshWriter {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private blocks: number[] = [];
  private kinds: number[] = [];
  private indices: number[] = [];

  quad(a: V3, b: V3, c: V3, d: V3, want: V3, color: Color, block = -1, kind = 1) {
    let n = cross(sub(b, a), sub(d, a));
    if (dot(n, want) < 0) {
      [b, d] = [d, b];
      n = cross(sub(b, a), sub(d, a));
    }
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-12) return;
    n = [n[0] / len, n[1] / len, n[2] / len];
    const base = this.positions.length / 3;
    for (const p of [a, b, c, d]) this.vertex(p, n, color, block, kind);
    this.indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  triangle(a: V3, b: V3, c: V3, want: V3, color: Color, block = -1, kind = 1) {
    let n = cross(sub(b, a), sub(c, a));
    if (dot(n, want) < 0) {
      [b, c] = [c, b];
      n = cross(sub(b, a), sub(c, a));
    }
    const len = Math.hypot(n[0], n[1], n[2]);
    if (len < 1e-12) return;
    n = [n[0] / len, n[1] / len, n[2] / len];
    const base = this.positions.length / 3;
    for (const p of [a, b, c]) this.vertex(p, n, color, block, kind);
    this.indices.push(base, base + 1, base + 2);
  }

  /** a'dan b'ye dikdörtgen kesitli kiriş (genişlik yatay, yükseklik düşey). */
  beam(a: V3, b: V3, width: number, height: number, color: Color) {
    const dir = sub(b, a);
    const len = Math.hypot(dir[0], dir[1], dir[2]);
    if (len < 1e-9) return;
    const f: V3 = [dir[0] / len, dir[1] / len, dir[2] / len];
    let side = cross(f, [0, 1, 0]);
    let sl = Math.hypot(side[0], side[1], side[2]);
    if (sl < 1e-6) {
      side = [1, 0, 0];
      sl = 1;
    }
    side = [side[0] / sl, side[1] / sl, side[2] / sl];
    const up = cross(side, f);
    const hw = width / 2;
    const hh = height / 2;
    const corner = (p: V3, sx: number, sy: number): V3 => [
      p[0] + side[0] * hw * sx + up[0] * hh * sy,
      p[1] + side[1] * hw * sx + up[1] * hh * sy,
      p[2] + side[2] * hw * sx + up[2] * hh * sy,
    ];
    // Kesitin köşeleri (yan, yukarı işaretleri) ve aralarındaki yüzlerin normalleri: üst, sağ, alt, sol
    const signs: [number, number][] = [
      [-1, 1],
      [1, 1],
      [1, -1],
      [-1, -1],
    ];
    const wants: V3[] = [up, side, [-up[0], -up[1], -up[2]], [-side[0], -side[1], -side[2]]];
    for (let i = 0; i < 4; i++) {
      const [s0x, s0y] = signs[i];
      const [s1x, s1y] = signs[(i + 1) % 4];
      this.quad(corner(a, s0x, s0y), corner(b, s0x, s0y), corner(b, s1x, s1y), corner(a, s1x, s1y), wants[i], color);
    }
  }

  /**
   * Taban merkezi (x, y, z) verilen, y ekseni etrafında döndürülmüş kutu.
   * Yerel +z yüzü `frontColor` ile boyanabilir.
   */
  box(x: number, y: number, z: number, size: [number, number, number], rotationY: number, color: Color, frontColor = color) {
    const [w, h, d] = size;
    const c = Math.cos(rotationY);
    const s = Math.sin(rotationY);
    const P = (lx: number, ly: number, lz: number): V3 => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    const dirs = { px: [c, 0, -s] as V3, pz: [s, 0, c] as V3 };
    const neg = (v: V3): V3 => [-v[0], -v[1], -v[2]];
    const hw = w / 2;
    const hd = d / 2;
    this.quad(P(-hw, 0, hd), P(hw, 0, hd), P(hw, h, hd), P(-hw, h, hd), dirs.pz, frontColor);
    this.quad(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, h, -hd), P(-hw, h, -hd), neg(dirs.pz), color);
    this.quad(P(hw, 0, -hd), P(hw, 0, hd), P(hw, h, hd), P(hw, h, -hd), dirs.px, color);
    this.quad(P(-hw, 0, -hd), P(-hw, 0, hd), P(-hw, h, hd), P(-hw, h, -hd), neg(dirs.px), color);
    this.quad(P(-hw, h, -hd), P(hw, h, -hd), P(hw, h, hd), P(-hw, h, hd), [0, 1, 0], color);
    this.quad(P(-hw, 0, -hd), P(hw, 0, -hd), P(hw, 0, hd), P(-hw, 0, hd), [0, -1, 0], color);
  }

  /** Düşey çokgen prizma (kolon). */
  prism(x: number, y: number, z: number, radius: number, height: number, color: Color, sides = 12) {
    for (let i = 0; i < sides; i++) {
      const a0 = (i / sides) * Math.PI * 2;
      const a1 = ((i + 1) / sides) * Math.PI * 2;
      const p0: V3 = [x + radius * Math.cos(a0), y, z + radius * Math.sin(a0)];
      const p1: V3 = [x + radius * Math.cos(a1), y, z + radius * Math.sin(a1)];
      const am = (a0 + a1) / 2;
      this.quad(p0, p1, [p1[0], y + height, p1[2]], [p0[0], y + height, p0[2]], [Math.cos(am), 0, Math.sin(am)], color);
      this.triangle([x, y + height, z], [p0[0], y + height, p0[2]], [p1[0], y + height, p1[2]], [0, 1, 0], color);
    }
  }

  get isEmpty() {
    return this.indices.length === 0;
  }

  toGeometry(): BufferGeometry {
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(this.positions, 3));
    g.setAttribute("normal", new Float32BufferAttribute(this.normals, 3));
    g.setAttribute("color", new Float32BufferAttribute(this.colors, 3));
    g.setAttribute("aBlock", new Float32BufferAttribute(this.blocks, 1));
    g.setAttribute("aKind", new Float32BufferAttribute(this.kinds, 1));
    g.setIndex(new Uint32BufferAttribute(this.indices, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }

  private vertex(p: V3, n: V3, color: Color, block: number, kind: number) {
    this.positions.push(p[0], p[1], p[2]);
    this.normals.push(n[0], n[1], n[2]);
    this.colors.push(color.r, color.g, color.b);
    this.blocks.push(block);
    this.kinds.push(kind);
  }
}

function sub(a: V3, b: V3): V3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function cross(a: V3, b: V3): V3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function dot(a: V3, b: V3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
