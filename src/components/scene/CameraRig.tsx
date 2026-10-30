"use client";

import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Box3, Matrix4, PerspectiveCamera, Quaternion, Vector3 } from "three";
import { stadium } from "@/lib/stadium/instance";
import {
  blockViewPose,
  OVERVIEW_POSE,
  PITCH_CENTER,
  seatApproachPoint,
  seatEye,
  type Point3,
  type Pose,
} from "@/lib/stadium/views";
import { useViewer, type ViewMode } from "@/store/useViewer";

const { ACTION } = CameraControlsImpl;

const ORBIT_FOV = 45;
/** Koltuk görünümünde hedef, kameranın bu kadar önünde durur; döndürme yerinde bakınmaya dönüşür. */
const FIRST_PERSON_DISTANCE = 0.1;
const NEAR_ORBIT = 1;
const NEAR_SEAT = 0.05;
const BOUNDS = new Box3(new Vector3(-240, -1, -240), new Vector3(240, 120, 240));
const UP = new Vector3(0, 1, 0);

interface Flight {
  start: number;
  duration: number;
  p0: Vector3;
  pc: Vector3;
  p1: Vector3;
  q0: Quaternion;
  q1: Quaternion;
  fov0: number;
  fov1: number;
  near1: number;
  onDone: () => void;
}

const v = (p: Point3) => new Vector3(p.x, p.y, p.z);
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

function lookQuaternion(from: Vector3, to: Vector3): Quaternion {
  return new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(from, to, UP));
}

function configureOrbit(c: CameraControlsImpl) {
  c.minDistance = 5;
  c.maxDistance = 450;
  c.minPolarAngle = 0.05;
  c.maxPolarAngle = Math.PI * 0.47;
  c.azimuthRotateSpeed = 1;
  c.polarRotateSpeed = 1;
  c.dollySpeed = 1;
  c.truckSpeed = 2;
  c.dollyToCursor = true;
  c.smoothTime = 0.3;
  c.draggingSmoothTime = 0.12;
  c.mouseButtons.left = ACTION.ROTATE;
  c.mouseButtons.middle = ACTION.DOLLY;
  c.mouseButtons.right = ACTION.TRUCK;
  c.mouseButtons.wheel = ACTION.DOLLY;
  c.touches.one = ACTION.TOUCH_ROTATE;
  c.touches.two = ACTION.TOUCH_DOLLY_TRUCK;
  c.touches.three = ACTION.TOUCH_TRUCK;
}

function configureFirstPerson(c: CameraControlsImpl, fov: number) {
  c.minDistance = 0;
  c.maxDistance = Infinity;
  // Bakış: 80° aşağı ile 60° yukarı arası
  c.minPolarAngle = 0.17;
  c.maxPolarAngle = 2.6;
  setLookSpeed(c, fov);
  c.dollyToCursor = false;
  c.smoothTime = 0.25;
  c.draggingSmoothTime = 0.08;
  c.mouseButtons.left = ACTION.ROTATE;
  c.mouseButtons.middle = ACTION.NONE;
  c.mouseButtons.right = ACTION.ROTATE;
  c.mouseButtons.wheel = ACTION.NONE;
  c.touches.one = ACTION.TOUCH_ROTATE;
  c.touches.two = ACTION.NONE;
  c.touches.three = ACTION.NONE;
}

/** Ters hız: sürüklemek dünyayı tutup çevirir (panorama gibi); dar açıda daha hassas. */
function setLookSpeed(c: CameraControlsImpl, fov: number) {
  const speed = -0.4 * (fov / 65);
  c.azimuthRotateSpeed = speed;
  c.polarRotateSpeed = speed;
}

function setNear(camera: PerspectiveCamera, near: number) {
  if (camera.near === near) return;
  camera.near = near;
  camera.updateProjectionMatrix();
}

export function CameraRig() {
  const controlsRef = useRef<CameraControlsImpl>(null);
  // Kamera, render dışında değiştirilen bir three.js nesnesi; her seferinde depodan okunur
  const get = useThree((s) => s.get);
  const invalidate = useThree((s) => s.invalidate);
  const domElement = useThree((s) => s.gl.domElement);
  const mode = useViewer((s) => s.mode);
  const selectedBlock = useViewer((s) => s.selectedBlock);
  const selectedSeat = useViewer((s) => s.selectedSeat);
  const fov = useViewer((s) => s.fov);
  const eyeHeight = useViewer((s) => s.eyeHeight);
  const flight = useRef<Flight | null>(null);
  const previous = useRef<{ mode: ViewMode; seat: number | null }>({ mode: "overview", seat: null });

  // İlk açılış
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    configureOrbit(c);
    c.setBoundary(BOUNDS);
    const { position: p, target: t } = OVERVIEW_POSE;
    c.setLookAt(p.x, p.y, p.z, t.x, t.y, t.z, false);
  }, []);

  // Mod ve seçim geçişleri
  useEffect(() => {
    const c = controlsRef.current;
    if (!c) return;
    const prev = previous.current;
    previous.current = { mode, seat: selectedSeat };
    const state = useViewer.getState();
    const camera = get().camera as PerspectiveCamera;

    const fly = (to: Vector3, lookAt: Vector3, via: Vector3, fov1: number, near1: number, onDone: () => void) => {
      const p0 = camera.position.clone();
      const distance = p0.distanceTo(to);
      c.enabled = false;
      state.setFlying(true);
      setNear(camera, Math.min(camera.near, NEAR_ORBIT));
      flight.current = {
        start: performance.now(),
        // "Hareketi azalt" tercihi varsa uçuş neredeyse anlık
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 250 : Math.min(2.4, Math.max(1.1, 0.9 + distance / 220)) * 1000,
        p0,
        pc: via,
        p1: to,
        q0: camera.quaternion.clone(),
        q1: lookQuaternion(to, lookAt),
        fov0: camera.fov,
        fov1,
        near1,
        onDone: () => {
          onDone();
          c.enabled = true;
          useViewer.getState().setFlying(false);
        },
      };
      invalidate();
    };

    const orbitTo = (pose: Pose, fromSeat: boolean, seatForExit: number | null) => {
      const to = v(pose.position);
      const target = v(pose.target);
      const finish = () => {
        configureOrbit(c);
        setNear(camera, NEAR_ORBIT);
        c.setLookAt(to.x, to.y, to.z, target.x, target.y, target.z, false);
      };
      if (fromSeat && seatForExit !== null) {
        fly(to, target, v(seatApproachPoint(stadium, seatForExit, state.eyeHeight)), ORBIT_FOV, NEAR_ORBIT, finish);
        return;
      }
      if (flight.current) {
        flight.current = null;
        c.enabled = true;
        state.setFlying(false);
      }
      configureOrbit(c);
      c.setLookAt(to.x, to.y, to.z, target.x, target.y, target.z, true);
    };

    if (mode === "seat" && selectedSeat !== null) {
      const eye = v(seatEye(stadium, selectedSeat, state.eyeHeight));
      const look = v(PITCH_CENTER);
      let via: Vector3;
      if (prev.mode === "seat" && prev.seat !== null && camera.position.distanceTo(eye) < 40) {
        // Yakın koltuklar arası geçiş: kısa, hafif yükselen bir yay
        via = camera.position.clone().lerp(eye, 0.5).add(new Vector3(0, 1.5, 0));
      } else {
        via = v(seatApproachPoint(stadium, selectedSeat, state.eyeHeight));
      }
      fly(eye, look, via, state.fov, NEAR_SEAT, () => {
        const currentFov = useViewer.getState().fov;
        configureFirstPerson(c, currentFov);
        camera.fov = currentFov;
        camera.near = NEAR_SEAT;
        camera.updateProjectionMatrix();
        const dir = look.clone().sub(eye).normalize().multiplyScalar(FIRST_PERSON_DISTANCE);
        c.setLookAt(eye.x, eye.y, eye.z, eye.x + dir.x, eye.y + dir.y, eye.z + dir.z, false);
      });
    } else if (mode === "block" && selectedBlock !== null) {
      orbitTo(blockViewPose(stadium, selectedBlock), prev.mode === "seat", prev.seat);
    } else if (mode === "overview") {
      orbitTo(OVERVIEW_POSE, prev.mode === "seat", prev.seat);
    }
  }, [mode, selectedBlock, selectedSeat, get, invalidate]);

  // Uçuş: kontroller her karede kamerayı kendi durumuna yazar; bu kanca ondan sonra çalışır
  useFrame((frame) => {
    const f = flight.current;
    if (!f) return;
    const camera = frame.camera as PerspectiveCamera;
    const t = Math.min(1, (performance.now() - f.start) / f.duration);
    const e = ease(t);
    const a = (1 - e) * (1 - e);
    const b = 2 * (1 - e) * e;
    const d = e * e;
    camera.position.set(
      a * f.p0.x + b * f.pc.x + d * f.p1.x,
      a * f.p0.y + b * f.pc.y + d * f.p1.y,
      a * f.p0.z + b * f.pc.z + d * f.p1.z,
    );
    camera.quaternion.slerpQuaternions(f.q0, f.q1, e);
    camera.fov = f.fov0 + (f.fov1 - f.fov0) * e;
    if (t > 0.85) setNear(camera, f.near1);
    camera.updateProjectionMatrix();
    if (t >= 1) {
      flight.current = null;
      f.onDone();
    }
    invalidate();
  });

  // Görüş açısı (koltuk görünümünde)
  useEffect(() => {
    const c = controlsRef.current;
    if (mode !== "seat" || !c || flight.current) return;
    const camera = get().camera as PerspectiveCamera;
    camera.fov = fov;
    camera.updateProjectionMatrix();
    setLookSpeed(c, fov);
    invalidate();
  }, [fov, mode, get, invalidate]);

  // Göz yüksekliği: bakış yönü korunur, yalnızca konum değişir
  useEffect(() => {
    const c = controlsRef.current;
    if (mode !== "seat" || selectedSeat === null || !c || flight.current) return;
    const eye = seatEye(stadium, selectedSeat, eyeHeight);
    const pos = c.getPosition(new Vector3());
    const dir = c.getTarget(new Vector3()).sub(pos);
    c.setLookAt(eye.x, eye.y, eye.z, eye.x + dir.x, eye.y + dir.y, eye.z + dir.z, true);
    // selectedSeat değişimi uçuşla ele alınır; burada yalnızca yükseklik izlenir
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eyeHeight]);

  // Koltuk görünümünde tekerlek ve iki parmak görüş açısını değiştirir
  useEffect(() => {
    if (mode !== "seat") return;
    const el = domElement;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useViewer.getState();
      s.setFov(s.fov * Math.exp(e.deltaY * 0.0015));
    };
    const touches = new Map<number, { x: number; y: number }>();
    let pinchStart = 0;
    let fovStart = 0;
    const spread = () => {
      const [a, b] = [...touches.values()];
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType !== "touch") return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2) {
        pinchStart = spread();
        fovStart = useViewer.getState().fov;
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!touches.has(e.pointerId)) return;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && pinchStart > 0) useViewer.getState().setFov((fovStart * pinchStart) / spread());
    };
    const onUp = (e: PointerEvent) => {
      touches.delete(e.pointerId);
      if (touches.size < 2) pinchStart = 0;
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [mode, domElement]);

  return <CameraControls ref={controlsRef} />;
}
