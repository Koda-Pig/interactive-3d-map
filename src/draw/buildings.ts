import type { BufferGeometry, MeshStandardMaterial } from "three";
import {
  type BufferAttribute,
  ExtrudeGeometry,
  Group,
  MathUtils,
  Matrix4,
  Mesh,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type {
  BuildingLocation,
  BuildingPart,
  Facing,
  ModelPlacement,
} from "../layout/locations.ts";
import { buildingParts } from "../layout/locations.ts";
import { resolveOutline } from "../layout/path.ts";
import type { Point } from "../layout/polygon.ts";
import { boundsOf, centreOf } from "../layout/polygon.ts";
import { heightAt } from "../terrain/height.ts";
import type { Kit, KitModel } from "./kit.ts";
import { kitMaterial, solidMaterial } from "./materials.ts";

// Walls start below the ground so a pad's edge can't leave a gap under them.
const WALL_SINK = 4;

const FACING_DEGREES: Readonly<Record<Facing, number>> = {
  south: 0,
  east: 90,
  north: 180,
  west: 270,
};

const Y_AXIS = new Vector3(0, 1, 0);

function partGeometry(part: BuildingPart, groundY: number): ExtrudeGeometry {
  const shape = new Shape(resolveOutline(part.footprint).map(([x, z]) => new Vector2(x, -z)));
  const sink = part.base ? 0 : WALL_SINK;
  const geometry = new ExtrudeGeometry(shape, {
    depth: part.height + sink,
    bevelEnabled: false,
  });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, groundY + (part.base ?? 0) - sink, 0);
  return geometry;
}

/** One copy of a model, in the model's own frame centred on its outline. */
interface Cell {
  readonly model: KitModel;
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly mirrored: boolean;
}

/** Lays a model out across an outline of the given size, or null if one is missing. */
function cellsFor(
  placement: ModelPlacement,
  kit: Kit,
  width: number,
  depth: number,
): Cell[] | null {
  const model = kit.get(placement.file);
  if (!model) {
    return null;
  }

  if (placement.endCap) {
    const cap = kit.get(placement.endCap);
    if (!cap) {
      return null;
    }
    const run = width - cap.width * 2;
    const count = Math.max(1, Math.round(run / model.width));
    const tile = run / count;
    const cells: Cell[] = [
      { model: cap, x: (cap.width - width) / 2, z: 0, width: cap.width, depth, mirrored: false },
      { model: cap, x: (width - cap.width) / 2, z: 0, width: cap.width, depth, mirrored: true },
    ];
    for (let index = 0; index < count; index += 1) {
      const x = -run / 2 + tile * (index + 0.5);
      cells.push({ model, x, z: 0, width: tile, depth, mirrored: false });
    }
    return cells;
  }

  const [columns, rows] = placement.grid ?? [1, 1];
  const cellWidth = width / columns;
  const cellDepth = depth / rows;
  const cells: Cell[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      cells.push({
        model,
        x: cellWidth * (column + 0.5) - width / 2,
        z: cellDepth * (row + 0.5) - depth / 2,
        width: cellWidth,
        depth: cellDepth,
        mirrored: false,
      });
    }
  }
  return cells;
}

/** A negative scale turns triangles inside out, so their corners are swapped back. */
function flipWinding(geometry: BufferGeometry): void {
  for (const name of ["position", "normal"]) {
    const attribute = geometry.getAttribute(name) as BufferAttribute;
    for (let vertex = 0; vertex + 2 < attribute.count; vertex += 3) {
      const x = attribute.getX(vertex);
      const y = attribute.getY(vertex);
      const z = attribute.getZ(vertex);
      attribute.setXYZ(
        vertex,
        attribute.getX(vertex + 2),
        attribute.getY(vertex + 2),
        attribute.getZ(vertex + 2),
      );
      attribute.setXYZ(vertex + 2, x, y, z);
    }
  }
}

type Pieces = Map<MeshStandardMaterial, BufferGeometry[]>;

const placedAt = new Vector3();
const placedScale = new Vector3();
const placedTurn = new Quaternion();
const placedMatrix = new Matrix4();

/** Fits a model to an outline and adds its pieces. False if the model isn't loaded. */
function addModel(
  pieces: Pieces,
  placement: ModelPlacement,
  outline: readonly Point[],
  top: number,
  groundY: number,
  kit: Kit,
): boolean {
  const { minX, minZ, maxX, maxZ } = boundsOf(outline);
  const sideways = placement.facing === "east" || placement.facing === "west";
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const cells = cellsFor(placement, kit, sideways ? spanZ : spanX, sideways ? spanX : spanZ);
  if (!cells) {
    return false;
  }

  const angle = MathUtils.degToRad(FACING_DEGREES[placement.facing]);
  placedTurn.setFromAxisAngle(Y_AXIS, angle);
  const centreX = (minX + maxX) / 2;
  const centreZ = (minZ + maxZ) / 2;

  for (const cell of cells) {
    const { model } = cell;
    placedAt
      .set(cell.x, 0, cell.z)
      .applyQuaternion(placedTurn)
      .add(new Vector3(centreX, groundY, centreZ));
    placedScale.set(
      (cell.width / model.width) * (cell.mirrored ? -1 : 1),
      top / model.height,
      cell.depth / model.depth,
    );
    placedMatrix.compose(placedAt, placedTurn, placedScale);

    for (const piece of model.pieces) {
      const material = kitMaterial(piece.material);
      const geometry = piece.geometry.clone().applyMatrix4(placedMatrix);
      if (cell.mirrored) {
        flipWinding(geometry);
      }
      pieces.set(material, [...(pieces.get(material) ?? []), geometry]);
    }
  }
  return true;
}

function addPieces(group: Group, pieces: Pieces): void {
  for (const [material, geometries] of pieces) {
    const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
    const mesh = new Mesh(merged, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}

/** Raises a building's footprints from one ground level, merged per colour. */
export function createBuilding(location: BuildingLocation, kit: Kit): Group {
  const parts = buildingParts(location);
  const outline = parts.flatMap((part) => resolveOutline(part.footprint));
  const [x, z] = centreOf(outline);
  const groundY = heightAt(x, z);

  const group = new Group();
  const pieces: Pieces = new Map();

  const top = Math.max(...parts.map((part) => (part.base ?? 0) + part.height));
  if (location.model && addModel(pieces, location.model, outline, top, groundY, kit)) {
    addPieces(group, pieces);
    return group;
  }

  const byColor = new Map<string, ExtrudeGeometry[]>();
  for (const part of parts) {
    const partGround = groundY + (part.base ?? 0);
    const partOutline = resolveOutline(part.footprint);
    if (part.model && addModel(pieces, part.model, partOutline, part.height, partGround, kit)) {
      continue;
    }
    const color = part.color ?? location.color;
    const geometries = byColor.get(color) ?? [];
    geometries.push(partGeometry(part, groundY));
    byColor.set(color, geometries);
  }

  addPieces(group, pieces);
  for (const [color, geometries] of byColor) {
    const geometry = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries);
    const mesh = new Mesh(geometry, solidMaterial(color));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  return group;
}
