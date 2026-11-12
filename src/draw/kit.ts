import type { BufferGeometry, MeshStandardMaterial } from "three";
import { BufferAttribute, Color, Mesh } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { buildingParts, layout } from "../layout/locations.ts";

/** The surface of one material in a model. */
export interface KitPiece {
  readonly geometry: BufferGeometry;
  readonly material: MeshStandardMaterial;
}

/** A model from the kit. Sizes leave out the skirt below ground. */
export interface KitModel {
  readonly pieces: readonly KitPiece[];
  readonly width: number;
  readonly depth: number;
  readonly height: number;
}

/** The models that loaded, by file. A missing one falls back to a plain shape. */
export type Kit = ReadonlyMap<string, KitModel>;

async function loadModel(loader: GLTFLoader, file: string): Promise<KitModel> {
  const gltf = await loader.loadAsync(`${import.meta.env.BASE_URL}models/${file}`);
  gltf.scene.updateMatrixWorld(true);

  const pieces: KitPiece[] = [];
  gltf.scene.traverse((child) => {
    if (child instanceof Mesh) {
      pieces.push({
        geometry: child.geometry.clone().applyMatrix4(child.matrixWorld),
        material: child.material as MeshStandardMaterial,
      });
    }
  });

  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  let height = 0;
  for (const { geometry } of pieces) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox;
    if (box) {
      minX = Math.min(minX, box.min.x);
      maxX = Math.max(maxX, box.max.x);
      minZ = Math.min(minZ, box.min.z);
      maxZ = Math.max(maxZ, box.max.z);
      height = Math.max(height, box.max.y);
    }
  }
  return { pieces, width: maxX - minX, depth: maxZ - minZ, height };
}

export const GATE_MODEL = "transport/entrance-gate.glb";

/** Every model file the layout data refers to. */
export function layoutModelFiles(): string[] {
  const files = new Set<string>();
  for (const location of layout.locations) {
    if (location.type === "gate") {
      files.add(GATE_MODEL);
    }
    if (location.type !== "building") {
      continue;
    }
    for (const model of [location.model, ...buildingParts(location).map((part) => part.model)]) {
      if (model) {
        files.add(model.file);
        if (model.endCap) {
          files.add(model.endCap);
        }
      }
    }
  }
  return [...files];
}

export async function loadKit(files: Iterable<string>): Promise<Kit> {
  const loader = new GLTFLoader();
  const kit = new Map<string, KitModel>();
  await Promise.all(
    [...new Set(files)].map(async (file) => {
      try {
        kit.set(file, await loadModel(loader, file));
      } catch (error) {
        console.warn(
          `Could not load the model "${file}", so a plain shape is drawn instead`,
          error,
        );
      }
    }),
  );
  return kit;
}

/**
 * One geometry for a whole model with its colours baked into the vertices, so
 * that thousands of copies can be drawn in a single call.
 */
export function bakedGeometry(model: KitModel): BufferGeometry {
  const color = new Color();
  const parts = model.pieces.map(({ geometry, material }) => {
    const baked = geometry.clone();
    baked.deleteAttribute("uv");
    color.copy(material.color);
    const count = baked.getAttribute("position").count;
    // The kit bakes its shading into vertex colours, which the material's colour multiplies.
    const shade = geometry.getAttribute("color");
    const colors = new Float32Array(count * 3);
    for (let vertex = 0; vertex < count; vertex += 1) {
      const amount = shade ? shade.getX(vertex) : 1;
      colors.set([color.r * amount, color.g * amount, color.b * amount], vertex * 3);
    }
    baked.setAttribute("color", new BufferAttribute(colors, 3));
    return baked;
  });
  const merged = mergeGeometries(parts);
  if (!merged) {
    throw new Error("A kit model's pieces could not be merged");
  }
  return merged;
}
