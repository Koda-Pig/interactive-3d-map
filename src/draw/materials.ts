import type { Object3D, Texture } from "three";
import { Color, Mesh, MeshLambertMaterial, MeshStandardMaterial } from "three";
import { createAsphaltTexture, createRippleTexture } from "./textures.ts";

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

export type SiteMaterial = MeshLambertMaterial | MeshStandardMaterial;

const SOLID_ROUGHNESS = 0.85;
const ROOF_LIGHTENER = new Color("#7A8794");
const ANISOTROPY = 4;

const solidMaterials = new Map<string, MeshStandardMaterial>();
const layerMaterials = new Map<string, MeshLambertMaterial>();
const kitMaterials = new Map<string, MeshStandardMaterial>();

export function solidMaterial(color: string): MeshStandardMaterial {
  let material = solidMaterials.get(color);
  if (!material) {
    material = new MeshStandardMaterial({ color, roughness: SOLID_ROUGHNESS });
    solidMaterials.set(color, material);
  }
  return material;
}

/** One shared copy of a kit material, tuned so that glass picks up the sky. */
export function kitMaterial(source: MeshStandardMaterial): MeshStandardMaterial {
  let material = kitMaterials.get(source.name);
  if (!material) {
    material = source.clone();
    if (material.name === "glass") {
      material.roughness = 0.1;
      material.metalness = 0.65;
    }
    if (material.name === "roof-dark") {
      // Seen from the air these are the largest surfaces on the map.
      material.color.lerp(ROOF_LIGHTENER, 0.42);
      material.roughness = 0.55;
    }
    kitMaterials.set(source.name, material);
  }
  return material;
}

function offsetParameters(layer: number) {
  return { polygonOffset: true, polygonOffsetFactor: -layer, polygonOffsetUnits: -layer * 4 };
}

export function layerMaterial(color: string, layer: number, map?: Texture): MeshLambertMaterial {
  const key = `${color}/${layer}/${map?.uuid ?? ""}`;
  let material = layerMaterials.get(key);
  if (!material) {
    material = new MeshLambertMaterial({ color, map: map ?? null, ...offsetParameters(layer) });
    layerMaterials.set(key, material);
  }
  return material;
}

let asphalt: Texture | null = null;

/** Grain and wear for anything with road coordinates. */
export function asphaltTexture(): Texture {
  asphalt ??= createAsphaltTexture(ANISOTROPY);
  return asphalt;
}

const RIPPLE_TILE_METRES = 420;

let ripples: Texture | null = null;

export function waterMaterial(color: string): MeshStandardMaterial {
  if (!ripples) {
    ripples = createRippleTexture(ANISOTROPY);
    // Flat shapes use their metres as texture coordinates.
    ripples.repeat.setScalar(1 / RIPPLE_TILE_METRES);
  }
  return new MeshStandardMaterial({
    color,
    roughness: 0.16,
    metalness: 0.3,
    normalMap: ripples,
    ...offsetParameters(Layer.area),
  });
}

let kerbMaterial: MeshLambertMaterial | null = null;

export function vertexColorMaterial(): MeshLambertMaterial {
  kerbMaterial ??= new MeshLambertMaterial({
    vertexColors: true,
    ...offsetParameters(Layer.marking),
  });
  return kerbMaterial;
}

const HIGHLIGHT = new Color("#1CA7EC");
const HIGHLIGHT_TINT = 0.8;
const HIGHLIGHT_GLOW = 0.35;

const highlightMaterials = new WeakMap<SiteMaterial, SiteMaterial>();
const baseMaterials = new WeakMap<Mesh, SiteMaterial>();

/** A cyan copy that keeps the original's layer, and a trace of its colour. */
function highlightMaterial(base: SiteMaterial): SiteMaterial {
  let material = highlightMaterials.get(base);
  if (!material) {
    material = base.clone();
    material.vertexColors = false;
    // The original may be caught partway through a precinct fade.
    material.transparent = false;
    material.opacity = 1;
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
    const base = baseMaterials.get(child) ?? (child.material as SiteMaterial);
    baseMaterials.set(child, base);
    child.material = highlighted ? highlightMaterial(base) : base;
  });
}

/** Changes a mesh's normal material, without losing a highlight it has on. */
export function setBaseMaterial(mesh: Mesh, material: SiteMaterial): void {
  const base = baseMaterials.get(mesh);
  const highlighted = base !== undefined && mesh.material !== base;
  baseMaterials.set(mesh, material);
  mesh.material = highlighted ? highlightMaterial(material) : material;
}
