"use client";

import { useEffect, useMemo } from "react";
import { stadium } from "@/lib/stadium/instance";
import { buildGrassGeometry, buildLineGeometry } from "@/lib/three/pitchGeometry";

const noRaycast = () => null;

/** Çim (tribün önüne kadar), saha çizgileri ve reklam panoları. */
export function Pitch() {
  const { pitch, colors } = stadium.data;
  const front = stadium.tiers[0].ring.shape;

  const grass = useMemo(
    () => buildGrassGeometry(pitch, front.halfX, front.halfZ, colors.grassLight, colors.grassDark),
    [pitch, front.halfX, front.halfZ, colors.grassLight, colors.grassDark],
  );
  const lines = useMemo(() => buildLineGeometry(pitch), [pitch]);
  useEffect(() => () => grass.dispose(), [grass]);
  useEffect(() => () => lines.dispose(), [lines]);

  const L = pitch.length / 2;
  const W = pitch.width / 2;
  const { height, offsetSides, offsetEnds, color } = pitch.adBoards;
  const thickness = 0.12;
  const boards: { position: [number, number, number]; size: [number, number, number] }[] = [
    { position: [0, height / 2, -(W + offsetSides)], size: [pitch.length + 6, height, thickness] },
    { position: [0, height / 2, W + offsetSides], size: [pitch.length + 6, height, thickness] },
    { position: [-(L + offsetEnds), height / 2, 0], size: [thickness, height, pitch.width - 4] },
    { position: [L + offsetEnds, height / 2, 0], size: [thickness, height, pitch.width - 4] },
  ];

  return (
    <group>
      <mesh geometry={grass} raycast={noRaycast}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={lines} raycast={noRaycast}>
        <meshLambertMaterial color={colors.line} polygonOffset polygonOffsetFactor={-2} polygonOffsetUnits={-4} />
      </mesh>
      {boards.map((b, i) => (
        <mesh key={i} position={b.position} raycast={noRaycast}>
          <boxGeometry args={b.size} />
          <meshLambertMaterial color={color} emissive="#1b3a8a" emissiveIntensity={0.35} />
        </mesh>
      ))}
    </group>
  );
}
