import type { Object3D, Texture } from "three";
import { Color, Mesh, MeshLambertMaterial, MeshStandardMaterial } from "three";
import { createAsphaltTexture, createRippleTexture } from "./textures.ts";

/**
 * Flat layers lie almost on top of each other, so depth precision alone can't
 * separate them from far away. Higher layers are pulled towards the camera.
 */
export const Layer = {
  area: 1,
  /** The lowest road. Wider roads go up to `verge`, so that junctions have a clear winner. */
  road: 2,
  /** Above roads, so a road passing under the circuit stays hidden. */
  verge: 5,
  track: 6,
  marking: 7,
  outline: 8,
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

export function offsetParameters(layer: number) {
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

const vertexMaterials = new Map<number, MeshLambertMaterial>();

export function vertexColorMaterial(layer: number = Layer.marking): MeshLambertMaterial {
  let material = vertexMaterials.get(layer);
  if (material) return material;
  material = new MeshLambertMaterial({
    vertexColors: true,
    ...offsetParameters(layer),
  });
  vertexMaterials.set(layer, material);
  return material;
}

export const HIGHLIGHT = new Color("#1CA7EC");

export type HighlightLevel = "hover" | "selected";

export interface HighlightLook {
  readonly tint: number;
  readonly glow: number;
  readonly keepsVertexColors: boolean;
}

type HighlightLooks = Readonly<Record<HighlightLevel, HighlightLook>>;

/** Buildings stay recognisable: their roofs, glass and shading all still show. */
const BUILDING_LOOKS: HighlightLooks = {
  hover: { tint: 0.07, glow: 0.03, keepsVertexColors: true },
  selected: { tint: 0.15, glow: 0.05, keepsVertexColors: true },
};

/** Flat shapes and markers have no form to lose, and no ground outline to help them. */
const FLAT_LOOKS: HighlightLooks = {
  hover: { tint: 0.5, glow: 0.2, keepsVertexColors: false },
  selected: { tint: 0.8, glow: 0.35, keepsVertexColors: false },
};

export function highlightLook(building: boolean, level: HighlightLevel): HighlightLook {
  return (building ? BUILDING_LOOKS : FLAT_LOOKS)[level];
}

const highlightMaterials = new WeakMap<SiteMaterial, Map<HighlightLook, SiteMaterial>>();
const baseMaterials = new WeakMap<Mesh, SiteMaterial>();
const meshLooks = new WeakMap<Mesh, HighlightLook>();

function paintHighlight(material: SiteMaterial, base: SiteMaterial, look: HighlightLook): void {
  material.color.copy(base.color).lerp(HIGHLIGHT, look.tint);
}

/** A cyan-tinted copy that keeps the original's layer. */
function highlightMaterial(base: SiteMaterial, look: HighlightLook): SiteMaterial {
  let copies = highlightMaterials.get(base);
  if (!copies) {
    copies = new Map();
    highlightMaterials.set(base, copies);
  }
  let material = copies.get(look);
  if (!material) {
    material = base.clone();
    material.vertexColors &&= look.keepsVertexColors;
    // The original may be caught partway through a precinct fade.
    material.transparent = false;
    material.opacity = 1;
    paintHighlight(material, base, look);
    material.emissive.copy(HIGHLIGHT);
    material.emissiveIntensity = look.glow;
    copies.set(look, material);
  }
  return material;
}

/** Sets the highlight on everything drawn by a location, or clears it with `null`. */
export function setHighlight(object: Object3D, look: HighlightLook | null): void {
  object.traverse((child) => {
    if (!(child instanceof Mesh)) {
      return;
    }
    const base = baseMaterials.get(child) ?? (child.material as SiteMaterial);
    baseMaterials.set(child, base);
    if (look) {
      meshLooks.set(child, look);
    } else {
      meshLooks.delete(child);
    }
    child.material = look ? highlightMaterial(base, look) : base;
  });
}

/** Changes a mesh's normal material, without losing a highlight it has on. */
export function setBaseMaterial(mesh: Mesh, material: SiteMaterial): void {
  baseMaterials.set(mesh, material);
  const look = meshLooks.get(mesh);
  mesh.material = look ? highlightMaterial(material, look) : material;
}

/** Call after changing a material's colour, so its highlighted copies follow. */
export function refreshHighlights(base: SiteMaterial): void {
  for (const [look, material] of highlightMaterials.get(base) ?? []) {
    paintHighlight(material, base, look);
  }
}
