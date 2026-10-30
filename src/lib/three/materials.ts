import { CanvasTexture, Color, DoubleSide, FrontSide, MeshLambertMaterial, RepeatWrapping, SRGBColorSpace, type Material } from "three";

/**
 * Tribün ve koltuk malzemelerinin paylaştığı uniform'lar. Değerleri
 * değiştirmek geometriyi yeniden üretmeden vurguyu günceller.
 */
export const highlightUniforms = {
  uHover: { value: -1 },
  uSelected: { value: -1 },
  uHoverColor: { value: new Color("#7fb2ff") },
  uSelectedColor: { value: new Color("#f5c400") },
  uConcrete: { value: new Color("#a3a7ad") },
  /** Bu mesafeden sonra basamaklar beton renginden koltuk rengine geçer. */
  uNear: { value: 45 },
  uFar: { value: 140 },
};

const VERTEX_HEAD = /* glsl */ `
attribute float aBlock;
attribute float aKind;
varying float vBlock;
varying float vKind;
varying float vDist;
`;

const FRAGMENT_HEAD = /* glsl */ `
uniform float uHover;
uniform float uSelected;
uniform vec3 uHoverColor;
uniform vec3 uSelectedColor;
uniform vec3 uConcrete;
uniform float uNear;
uniform float uFar;
varying float vBlock;
varying float vKind;
varying float vDist;
`;

const FRAGMENT_BODY = /* glsl */ `
#include <color_fragment>
if (vKind < 0.5) {
  diffuseColor.rgb = mix(uConcrete, diffuseColor.rgb, smoothstep(uNear, uFar, vDist));
}
// aBlock = -1 blok dışı yüzeylerdir (koridor, korkuluk); "seçim yok" (-1) ile eşleşmemeli
if (vBlock > -0.5 && abs(vBlock - uSelected) < 0.5) {
  diffuseColor.rgb = mix(diffuseColor.rgb, uSelectedColor, 0.35);
} else if (vBlock > -0.5 && abs(vBlock - uHover) < 0.5) {
  diffuseColor.rgb = mix(diffuseColor.rgb, uHoverColor, 0.4);
}
`;

/**
 * Lambert malzemesine blok vurgusu ve uzaklığa bağlı basamak rengi ekler.
 * Geometride `aBlock` ve `aKind` öznitelikleri olmalı (koltuklarda aBlock
 * örnek başına InstancedBufferAttribute'tur).
 */
export function createHighlightMaterial(options: { vertexColors?: boolean; doubleSided?: boolean } = {}): MeshLambertMaterial {
  const material = new MeshLambertMaterial({ vertexColors: options.vertexColors ?? false, side: options.doubleSided ? DoubleSide : FrontSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, highlightUniforms);
    shader.vertexShader = VERTEX_HEAD + shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\nvBlock = aBlock;\nvKind = aKind;\nvDist = -mvPosition.z;",
    );
    shader.fragmentShader = FRAGMENT_HEAD + shader.fragmentShader.replace("#include <color_fragment>", FRAGMENT_BODY);
  };
  material.customProgramCacheKey = () => `stadium-highlight-${options.doubleSided ? "double" : "front"}`;
  return material;
}

/** Kale filesi için tekrar eden ağ dokusu (mipmap sayesinde uzaktan hafif bir tül gibi görünür). */
export function createNetTexture(): CanvasTexture {
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function disposeAll(...items: (Material | { dispose(): void } | null | undefined)[]) {
  for (const item of items) item?.dispose();
}
