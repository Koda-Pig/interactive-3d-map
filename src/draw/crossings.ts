import { BoxGeometry, type BufferGeometry, Group, Mesh, type MeshStandardMaterial } from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { TrackLocation } from "../layout/locations.ts";
import { resolvePath, samplePath } from "../layout/path.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import { solidMaterial } from "./materials.ts";

/** One elevation profile for the deck, ramps, parapets and abutments. */
export function createCrossing(road: TrackLocation, surface: GroundSurface) {
  const structure = new Group();
  const pieces = new Map<MeshStandardMaterial, BufferGeometry[]>();
  const addPiece = (mesh: Mesh<BoxGeometry, MeshStandardMaterial>): void => {
    mesh.updateMatrix();
    mesh.geometry.applyMatrix4(mesh.matrix);
    const geometries = pieces.get(mesh.material) ?? [];
    geometries.push(mesh.geometry);
    pieces.set(mesh.material, geometries);
  };
  const bridge = road.bridge;
  if (!bridge) {
    return {
      structure,
      heightAt: (x: number, z: number, _distance: number) => surface.heightAt(x, z),
    };
  }
  const { start, end, ramp, clearance } = bridge;
  const samples = samplePath(resolvePath(road.path, false), 4, false);
  const crossing = samples.filter((sample) => sample.distance >= start && sample.distance <= end);
  const deckY = Math.max(...crossing.map(({ x, z }) => surface.heightAt(x, z))) + clearance;
  const heightAt = (x: number, z: number, distance: number): number => {
    const ground = surface.heightAt(x, z);
    const t = Math.max(0, Math.min(1, (distance - start) / ramp, (end - distance) / ramp));
    const blend = t * t * (3 - 2 * t);
    return ground + (deckY - ground) * blend;
  };
  for (let index = 0; index < crossing.length - 1; index += 1) {
    const a = crossing[index];
    const b = crossing[index + 1];
    const yA = heightAt(a.x, a.z, a.distance);
    const yB = heightAt(b.x, b.z, b.distance);
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    const yaw = Math.atan2(-(b.z - a.z), b.x - a.x);
    const tilt = Math.atan2(yB - yA, length);
    for (const side of [-1, 1]) {
      const rail = new Mesh(new BoxGeometry(length + 0.2, 1.2, 0.5), solidMaterial("#E8ECEF"));
      const offset = (road.width / 2 + 0.25) * side;
      rail.position.set(
        (a.x + b.x) / 2 - a.dirZ * offset,
        (yA + yB) / 2 + 0.9,
        (a.z + b.z) / 2 + a.dirX * offset,
      );
      rail.rotation.set(0, yaw, tilt, "YXZ");
      rail.castShadow = true;
      addPiece(rail);
    }
    const slab = new Mesh(new BoxGeometry(length + 0.2, 0.8, road.width), solidMaterial("#7C858E"));
    slab.position.set((a.x + b.x) / 2, (yA + yB) / 2 - 0.1, (a.z + b.z) / 2);
    slab.rotation.set(0, yaw, tilt, "YXZ");
    slab.castShadow = true;
    slab.receiveShadow = true;
    addPiece(slab);
  }
  for (const station of [start + ramp, end - ramp]) {
    const sample = samples.reduce((best, point) =>
      Math.abs(point.distance - station) < Math.abs(best.distance - station) ? point : best,
    );
    const ground = surface.heightAt(sample.x, sample.z);
    const height = deckY - ground;
    const support = new Mesh(new BoxGeometry(2, height, road.width + 1), solidMaterial("#C9CFD4"));
    support.position.set(sample.x, ground + height / 2 - 0.5, sample.z);
    support.rotation.y = Math.atan2(-sample.dirZ, sample.dirX);
    support.castShadow = true;
    addPiece(support);
  }
  for (const [material, geometries] of pieces) {
    const geometry = mergeGeometries(geometries);
    if (!geometry) throw new Error("The bridge structure could not be merged");
    const mesh = new Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    structure.add(mesh);
    for (const piece of geometries) piece.dispose();
  }
  structure.name = `${road.id}-bridge-structure`;
  return { structure, heightAt };
}
