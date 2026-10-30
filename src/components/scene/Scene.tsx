"use client";

import { Canvas } from "@react-three/fiber";
import { OVERVIEW_POSE } from "@/lib/stadium/views";
import { useViewer } from "@/store/useViewer";
import { CameraRig } from "./CameraRig";
import { Environment } from "./Environment";
import { Goals } from "./Goals";
import { Pitch } from "./Pitch";
import { Roof } from "./Roof";
import { Seats } from "./Seats";
import { Stands } from "./Stands";
import { Structures } from "./Structures";

const { x, y, z } = OVERVIEW_POSE.position;

/**
 * 3B sahne. frameloop="demand": yalnızca kamera hareket ederken, uçuşta
 * ya da durum değişince çizilir; sahne dururken GPU boşta kalır.
 */
export default function Scene() {
  // Dokunmatik (çoğunlukla mobil) cihazlarda piksel yoğunluğunu sınırla: akıcılık için
  const coarse = window.matchMedia("(pointer: coarse)").matches;
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, coarse ? 1.5 : 1.75]}
      camera={{ fov: 45, near: 1, far: 4000, position: [x, y, z] }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      onPointerMissed={() => useViewer.getState().setHover(null)}
    >
      <Environment />
      <Pitch />
      <Goals />
      <Stands />
      <Seats />
      <Structures />
      <Roof />
      <CameraRig />
    </Canvas>
  );
}
