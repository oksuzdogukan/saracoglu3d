"use client";

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Color, InstancedBufferAttribute, MeshLambertMaterial, type InstancedMesh } from "three";
import { stadium } from "@/lib/stadium/instance";
import { nearbyBlocks } from "@/lib/stadium/views";
import { createHighlightMaterial } from "@/lib/three/materials";
import { createFarSeatGeometry, createNearSeatGeometry, seatMatrix } from "@/lib/three/seatGeometry";
import { useViewer } from "@/store/useViewer";
import { CLICK_TOLERANCE } from "./Stands";

/** Genel görünümde kamera bundan uzaktaysa tek tek koltuklar gizlenir (bloklar düz renk görünür). */
const FAR_SEATS_MAX_DISTANCE = 420;
const HOVER_SEAT_COLOR = new Color("#7fb2ff");
const noRaycast = () => {};

export function Seats() {
  return (
    <>
      <FarSeats />
      <NearSeats />
    </>
  );
}

/** Tüm koltuklar, 4 üçgenlik basit model; tek çizim çağrısı. */
function FarSeats() {
  const { seats } = stadium;
  const palette = useMemo(() => stadium.seatPalette.map((c) => new Color(c)), []);
  const meshRef = useRef<InstancedMesh>(null);
  const geometry = useMemo(() => {
    const g = createFarSeatGeometry();
    g.setAttribute("aBlock", new InstancedBufferAttribute(Float32Array.from(seats.block), 1));
    return g;
  }, [seats]);
  const material = useMemo(() => createHighlightMaterial({ doubleSided: true }), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < seats.count; i++) {
      mesh.setMatrixAt(i, seatMatrix(seats, i));
      mesh.setColorAt(i, palette[seats.color[i]]);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [geometry, seats, palette]);

  useFrame(({ camera }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.visible = useViewer.getState().mode !== "overview" || camera.position.length() < FAR_SEATS_MAX_DISTANCE;
  });

  return <instancedMesh ref={meshRef} args={[geometry, material, Math.max(1, seats.count)]} raycast={noRaycast} />;
}

/**
 * Ayrıntılı koltuklar: blok modunda seçili bloğun, koltuk görünümünde
 * çevredeki blokların koltukları. Blok modunda koltuğa dokunmak o koltuğun
 * görünümünü açar.
 */
function NearSeats() {
  const { seats, blocks } = stadium;
  const palette = useMemo(() => stadium.seatPalette.map((c) => new Color(c)), []);
  const meshRef = useRef<InstancedMesh>(null);
  const slotOf = useRef(new Map<number, number>());
  const mode = useViewer((s) => s.mode);
  const selectedBlock = useViewer((s) => s.selectedBlock);
  const selectedSeat = useViewer((s) => s.selectedSeat);
  const hoverSeat = useViewer((s) => s.hover?.seat ?? null);
  const setHover = useViewer((s) => s.setHover);
  const selectSeat = useViewer((s) => s.selectSeat);

  const geometry = useMemo(() => createNearSeatGeometry(), []);
  const material = useMemo(() => new MeshLambertMaterial(), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const list = useMemo(() => {
    let blockList: number[] = [];
    if (mode === "block" && selectedBlock !== null) blockList = [selectedBlock];
    else if (mode === "seat" && selectedSeat !== null) blockList = nearbyBlocks(stadium, selectedSeat);
    const out: number[] = [];
    for (const b of blockList) {
      for (let i = blocks[b].seatStart; i < blocks[b].seatStart + blocks[b].seatCount; i++) out.push(i);
    }
    return out;
  }, [mode, selectedBlock, selectedSeat, blocks]);

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const slots = new Map<number, number>();
    list.forEach((seat, slot) => {
      mesh.setMatrixAt(slot, seatMatrix(seats, seat));
      mesh.setColorAt(slot, palette[seats.color[seat]]);
      slots.set(seat, slot);
    });
    slotOf.current = slots;
    mesh.count = list.length;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [list, seats, palette]);

  // Üzerine gelinen koltuğu boya, ayrılınca eski rengine döndür
  useLayoutEffect(() => {
    const mesh = meshRef.current;
    const slot = hoverSeat === null ? undefined : slotOf.current.get(hoverSeat);
    if (!mesh?.instanceColor || hoverSeat === null || slot === undefined) return;
    const colors = mesh.instanceColor;
    mesh.setColorAt(slot, HOVER_SEAT_COLOR);
    colors.needsUpdate = true;
    return () => {
      mesh.setColorAt(slot, palette[seats.color[hoverSeat]]);
      colors.needsUpdate = true;
    };
  }, [hoverSeat, list, seats, palette]);

  const seatAt = (instanceId: number | undefined) => (instanceId === undefined ? null : (list[instanceId] ?? null));
  const interactive = () => {
    const s = useViewer.getState();
    return s.mode === "block" && !s.flying;
  };

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, Math.max(1, seats.count)]}
      count={0}
      onPointerMove={(e: ThreeEvent<PointerEvent>) => {
        if (!interactive()) return;
        const seat = seatAt(e.instanceId);
        if (seat === null) return;
        e.stopPropagation();
        setHover({ block: seats.block[seat], seat, x: e.nativeEvent.offsetX, y: e.nativeEvent.offsetY });
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        if (!interactive() || e.delta > CLICK_TOLERANCE) return;
        const seat = seatAt(e.instanceId);
        if (seat === null) return;
        e.stopPropagation();
        selectSeat(seat);
      }}
    />
  );
}
