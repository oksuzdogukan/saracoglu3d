"use client";

import { useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { stadium } from "@/lib/stadium/instance";
import { createNetTexture } from "@/lib/three/materials";
import { buildNetGeometry } from "@/lib/three/pitchGeometry";

const noRaycast = () => null;
/** File gözü (m). Tipik kale filesi 10–12 cm. */
const NET_MESH = 0.12;

/** Gerçek ölçülü kaleler: direkler, üst direk ve file. */
export function Goals() {
  const { pitch } = stadium.data;
  const texture = useMemo(() => {
    const t = createNetTexture();
    t.repeat.set(1 / NET_MESH, 1 / NET_MESH);
    return t;
  }, []);
  const nets = useMemo(() => [buildNetGeometry(pitch, -1), buildNetGeometry(pitch, 1)], [pitch]);
  useEffect(() => () => texture.dispose(), [texture]);
  useEffect(() => () => nets.forEach((n) => n.dispose()), [nets]);

  const { width, height, postDiameter } = pitch.goal;
  const r = postDiameter / 2;

  return (
    <group>
      {([-1, 1] as const).map((sign, i) => {
        // Direkler kale çizgisinin üzerinde; arka yüzleri çizginin dış kenarıyla hizalı
        const x = sign * (pitch.length / 2 - r);
        return (
          <group key={sign}>
            {[-1, 1].map((zs) => (
              <mesh key={zs} position={[x, (height + r) / 2, zs * (width / 2 + r)]} raycast={noRaycast}>
                <cylinderGeometry args={[r, r, height + r, 12]} />
                <meshLambertMaterial color="#ffffff" />
              </mesh>
            ))}
            <mesh position={[x, height + r, 0]} rotation-x={Math.PI / 2} raycast={noRaycast}>
              <cylinderGeometry args={[r, r, width + 4 * r, 12]} />
              <meshLambertMaterial color="#ffffff" />
            </mesh>
            <mesh geometry={nets[i]} raycast={noRaycast} renderOrder={2}>
              <meshBasicMaterial map={texture} transparent side={DoubleSide} depthWrite={false} opacity={0.85} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
