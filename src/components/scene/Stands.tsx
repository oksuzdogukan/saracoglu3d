"use client";

import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { DoubleSide, MeshBasicMaterial } from "three";
import { stadium } from "@/lib/stadium/instance";
import { createHighlightMaterial, highlightUniforms } from "@/lib/three/materials";
import { buildTerraceGeometry } from "@/lib/three/terraceGeometry";
import { useViewer } from "@/store/useViewer";

/** Tıklamayı sürüklemeden ayırmak için piksel eşiği. */
export const CLICK_TOLERANCE = 6;

/** Basamaklar, koridorlar, duvarlar ve korkuluklar; blok üzerine gelme ve seçme. */
export function Stands() {
  const { terrace, glass } = useMemo(() => buildTerraceGeometry(stadium), []);
  const material = useMemo(() => createHighlightMaterial({ vertexColors: true }), []);
  const glassMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#c9dceb", transparent: true, opacity: 0.25, side: DoubleSide, depthWrite: false }),
    [],
  );
  useEffect(
    () => () => {
      terrace.dispose();
      glass.dispose();
      material.dispose();
      glassMaterial.dispose();
    },
    [terrace, glass, material, glassMaterial],
  );

  const setHover = useViewer((s) => s.setHover);
  const selectBlock = useViewer((s) => s.selectBlock);

  const blockAt = (e: ThreeEvent<PointerEvent | MouseEvent>) => {
    if (e.faceIndex == null || !terrace.index) return -1;
    return terrace.getAttribute("aBlock").getX(terrace.index.getX(e.faceIndex * 3));
  };
  const interactive = () => {
    const { mode, flying } = useViewer.getState();
    return mode !== "seat" && !flying;
  };

  return (
    <>
      <mesh
        geometry={terrace}
        material={material}
        onPointerMove={(e) => {
          if (!interactive()) return;
          const block = blockAt(e);
          setHover(block >= 0 ? { block, seat: null, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY } : null);
        }}
        onPointerOut={() => setHover(null)}
        onClick={(e) => {
          if (!interactive() || e.delta > CLICK_TOLERANCE) return;
          const block = blockAt(e);
          if (block < 0) return;
          e.stopPropagation();
          selectBlock(block);
        }}
      />
      <mesh geometry={glass} material={glassMaterial} raycast={() => null} renderOrder={1} />
      <HighlightSync />
    </>
  );
}

/** Mağaza durumunu shader uniform'larına aktarır (geometri yeniden üretilmez). */
function HighlightSync() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    highlightUniforms.uConcrete.value.set(stadium.data.colors.concrete);
    const apply = (s: ReturnType<typeof useViewer.getState>) => {
      const seatMode = s.mode === "seat";
      highlightUniforms.uHover.value = !seatMode && s.hover ? s.hover.block : -1;
      highlightUniforms.uSelected.value = s.mode === "block" && s.selectedBlock !== null ? s.selectedBlock : -1;
      invalidate();
    };
    apply(useViewer.getState());
    return useViewer.subscribe(apply);
  }, [invalidate]);
  return null;
}
