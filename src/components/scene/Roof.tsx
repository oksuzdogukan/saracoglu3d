"use client";

import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { stadium } from "@/lib/stadium/instance";
import { buildRoofGeometry } from "@/lib/three/roofGeometry";
import { useViewer } from "@/store/useViewer";

const noRaycast = () => null;
/** Genel görünümde çatı yarı saydam: bloklar yukarıdan görünsün, çatının yeri belli olsun. */
const GHOST_OPACITY = 0.16;

/**
 * Çatı yalnızca koltuk görünümünde tam görünür; orada görüşü etkileyen
 * ön kenar, ışık köprüsü ve kirişler önemlidir.
 */
export function Roof() {
  const roof = stadium.roof;
  const geometries = useMemo(() => (roof ? buildRoofGeometry(roof) : null), [roof]);
  useEffect(
    () => () => {
      geometries?.membrane.dispose();
      geometries?.steel.dispose();
    },
    [geometries],
  );
  const solid = useViewer((s) => s.mode === "seat" && !s.flying);
  if (!geometries) return null;
  const opacity = solid ? 1 : GHOST_OPACITY;

  return (
    <group>
      <mesh geometry={geometries.membrane} raycast={noRaycast} renderOrder={3}>
        <meshLambertMaterial vertexColors side={DoubleSide} transparent opacity={opacity} depthWrite={solid} />
      </mesh>
      <mesh geometry={geometries.steel} raycast={noRaycast} renderOrder={3}>
        <meshLambertMaterial vertexColors transparent opacity={solid ? 1 : GHOST_OPACITY * 2} depthWrite={solid} />
      </mesh>
    </group>
  );
}
