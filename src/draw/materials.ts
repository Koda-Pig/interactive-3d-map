import { Color, Mesh, MeshLambertMaterial } from "three";
import type { Object3D } from "three";

/**
 * Flat layers lie almost on top of each other, so depth precision alone can't
 * separate them from far away. Higher layers are pulled towards the camera.
 */
export const Layer = {
  area: 1,
  road: 2,
  /** Above roads, so a road passing under the circuit stays hidden. */
  verge: 3,
  track: 4,
  marking: 5,
} as const;

const solidMaterials = new Map<string, MeshLambertMaterial>();
const layerMaterials = new Map<string, MeshLambertMaterial>();

export function solidMaterial(color: string): MeshLambertMaterial {
  let material = solidMaterials.get(color);
  if (!material) {
    material = new MeshLambertMaterial({ color });
    solidMaterials.set(color, material);
  }
  return material;
}

export function layerMaterial(color: string, layer: number): MeshLambertMaterial {
  const key = `${color}/${layer}`;
  let material = layerMaterials.get(key);
  if (!material) {
    material = new MeshLambertMaterial({
      color,
      polygonOffset: true,
      polygonOffsetFactor: -layer,
      polygonOffsetUnits: -layer * 4,
    });
    layerMaterials.set(key, material);
  }
  return material;
}

let kerbMaterial: MeshLambertMaterial | null = null;

export function vertexColorMaterial(): MeshLambertMaterial {
  kerbMaterial ??= new MeshLambertMaterial({
    vertexColors: true,
    polygonOffset: true,
    polygonOffsetFactor: -Layer.marking,
    polygonOffsetUnits: -Layer.marking * 4,
  });
  return kerbMaterial;
}

const HIGHLIGHT = new Color("#1CA7EC");
const HIGHLIGHT_TINT = 0.8;
const HIGHLIGHT_GLOW = 0.35;

const highlightMaterials = new WeakMap<MeshLambertMaterial, MeshLambertMaterial>();
const baseMaterials = new WeakMap<Mesh, MeshLambertMaterial>();

/** A cyan copy that keeps the original's layer, and a trace of its colour. */
function highlightMaterial(base: MeshLambertMaterial): MeshLambertMaterial {
  let material = highlightMaterials.get(base);
  if (!material) {
    material = base.clone();
    material.vertexColors = false;
    material.color.lerp(HIGHLIGHT, HIGHLIGHT_TINT);
    material.emissive.copy(HIGHLIGHT);
    material.emissiveIntensity = HIGHLIGHT_GLOW;
    highlightMaterials.set(base, material);
  }
  return material;
}

/** Turns the cyan highlight on or off for everything drawn by a location. */
export function setHighlighted(object: Object3D, highlighted: boolean): void {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }
    const base = baseMaterials.get(child) ?? (child.material as MeshLambertMaterial);
    baseMaterials.set(child, base);
    child.material = highlighted ? highlightMaterial(base) : base;
  });
}
