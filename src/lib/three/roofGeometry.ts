import { BufferGeometry, Color } from "three";
import type { RoofModel } from "../stadium/roof";
import type { SideName } from "../stadium/schema";
import { MeshWriter, type V3 } from "./meshWriter";

export interface RoofGeometries {
  /** Membran yüzeyi ve kenar alınları. */
  membrane: BufferGeometry;
  /** Çelik: ışınsal kirişler, ışık köprüsü, kafes kirişler. */
  steel: BufferGeometry;
}

/** Kenara paralel bir doğru üzerindeki u konumunu plana çevirir (saat yönü). */
function sidePoint(side: SideName, distance: number, u: number): { x: number; z: number } {
  switch (side) {
    case "top":
      return { x: u, z: -distance };
    case "right":
      return { x: distance, z: u };
    case "bottom":
      return { x: -u, z: distance };
    case "left":
      return { x: -distance, z: -u };
  }
}

export function buildRoofGeometry(roof: RoofModel): RoofGeometries {
  const { data, inner, rays } = roof;
  const membrane = new MeshWriter();
  const steel = new MeshWriter();
  const skin = new Color(data.color);
  const edge = new Color(data.color).multiplyScalar(0.82);
  const hIn = data.innerHeight;
  const hOut = data.outerHeight;

  for (let i = 0; i + 1 < rays.length; i++) {
    const a = rays[i];
    const b = rays[i + 1];
    membrane.quad([a.inner.x, hIn, a.inner.z], [b.inner.x, hIn, b.inner.z], [b.outer.x, hOut, b.outer.z], [a.outer.x, hOut, a.outer.z], [0, 1, 0], skin);
    const n = inner.normal((a.s + b.s) / 2);
    const inward: V3 = [-n.x, 0, -n.z];
    membrane.quad(
      [a.inner.x, hIn - data.edgeDepth, a.inner.z],
      [b.inner.x, hIn - data.edgeDepth, b.inner.z],
      [b.inner.x, hIn, b.inner.z],
      [a.inner.x, hIn, a.inner.z],
      inward,
      edge,
    );
    const ob = hOut - data.outerEdgeDepth;
    membrane.quad([a.outer.x, ob, a.outer.z], [b.outer.x, ob, b.outer.z], [b.outer.x, hOut, b.outer.z], [a.outer.x, hOut, a.outer.z], [n.x, 0, n.z], edge);
  }

  // Membranın altındaki ışınsal kirişler
  const rib = new Color(data.ribs.color);
  const ribCount = Math.max(4, Math.round(inner.perimeter / data.ribs.spacing));
  for (let k = 0; k < ribCount; k++) {
    const ray = roof.rayAt((inner.perimeter * k) / ribCount);
    const drop = data.ribs.depth / 2;
    steel.beam([ray.inner.x, hIn - drop, ray.inner.z], [ray.outer.x, hOut - drop, ray.outer.z], data.ribs.width, data.ribs.depth, rib);
  }

  // Ön kenarın altındaki ışık köprüsü
  if (data.catwalk) {
    const { offset, drop, size, color } = data.catwalk;
    const c = new Color(color);
    const y = hIn - drop;
    for (let i = 0; i + 1 < rays.length; i++) {
      const p = inner.point(rays[i].s, offset);
      const q = inner.point(rays[i + 1].s, offset);
      steel.beam([p.x, y, p.z], [q.x, y, q.z], size, size, c);
    }
  }

  // Çatının üstündeki Warren kafes kirişler
  const truss = new Color(data.trussColor);
  const m = data.trussMember;
  for (const t of data.trusses) {
    const panels = Math.max(1, Math.round((t.to - t.from) / t.panel));
    const node = (u: number, lift: number): V3 => {
      const p = sidePoint(t.side, t.distance, u);
      return [p.x, roof.heightAt(p.x, p.z) + lift, p.z];
    };
    const step = (t.to - t.from) / panels;
    const bottom = Array.from({ length: panels + 1 }, (_, i) => node(t.from + i * step, m));
    const top = Array.from({ length: panels }, (_, i) => node(t.from + (i + 0.5) * step, t.height));
    for (let i = 0; i < panels; i++) {
      steel.beam(bottom[i], bottom[i + 1], m, m, truss);
      steel.beam(bottom[i], top[i], m, m, truss);
      steel.beam(top[i], bottom[i + 1], m, m, truss);
      if (i + 1 < panels) steel.beam(top[i], top[i + 1], m, m, truss);
    }
  }

  return { membrane: membrane.toGeometry(), steel: steel.toGeometry() };
}
