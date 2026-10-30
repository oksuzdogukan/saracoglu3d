"use client";

import { useEffect, useMemo } from "react";
import { BackSide, Color, Float32BufferAttribute, SphereGeometry } from "three";
import { stadium } from "@/lib/stadium/instance";

const SKY_RADIUS = 1800;

/** Dikey renk geçişli gökyüzü küresi, ışıklar ve çevre zemini. */
export function Environment() {
  const { colors } = stadium.data;
  const sky = useMemo(() => {
    const g = new SphereGeometry(SKY_RADIUS, 32, 16);
    const top = new Color(colors.skyTop);
    const horizon = new Color(colors.skyHorizon);
    const pos = g.getAttribute("position");
    const col: number[] = [];
    const c = new Color();
    for (let i = 0; i < pos.count; i++) {
      const t = Math.max(0, pos.getY(i) / SKY_RADIUS);
      c.copy(horizon).lerp(top, Math.pow(t, 0.6));
      col.push(c.r, c.g, c.b);
    }
    g.setAttribute("color", new Float32BufferAttribute(col, 3));
    return g;
  }, [colors.skyTop, colors.skyHorizon]);
  useEffect(() => () => sky.dispose(), [sky]);

  return (
    <>
      <mesh geometry={sky} raycast={() => null} renderOrder={-1}>
        <meshBasicMaterial vertexColors side={BackSide} depthWrite={false} fog={false} />
      </mesh>
      <hemisphereLight args={[colors.skyTop, colors.ground, 1.4]} />
      <directionalLight position={[60, 140, 90]} intensity={1.9} />
      {/* Karşı yönden dolgu: Fenerium tarafındaki tribünler de karanlık kalmasın */}
      <directionalLight position={[-50, 110, -90]} intensity={1.0} />
      <mesh rotation-x={-Math.PI / 2} position-y={-0.03} raycast={() => null}>
        <planeGeometry args={[900, 900]} />
        <meshLambertMaterial color={colors.ground} />
      </mesh>
    </>
  );
}
