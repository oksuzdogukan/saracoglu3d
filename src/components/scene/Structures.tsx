"use client";

import { useEffect, useMemo } from "react";
import { stadium } from "@/lib/stadium/instance";
import { buildStructureGeometry } from "@/lib/three/structureGeometry";

/** Görüşü etkileyen basit yapılar: yedek kulübeleri, tünel, köşe ekranları, kolonlar. */
export function Structures() {
  const geometry = useMemo(() => buildStructureGeometry(stadium.structures), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  if (stadium.structures.length === 0) return null;
  return (
    <mesh geometry={geometry} raycast={() => null}>
      <meshLambertMaterial vertexColors />
    </mesh>
  );
}
