import type { Camera, Intersection, Material, Mesh, Object3D, Ray } from "three";
import { Raycaster, Vector2, Vector3 } from "three";
import type { Location } from "../layout/locations.ts";
import type { GroundSurface } from "../terrain/ground.ts";
import type { Precincts } from "./precincts.ts";

// Flat layers lie within this many metres of each other along a pick ray.
const SAME_SURFACE_DISTANCE = 2;

const GROUND_CHECK_STEPS = 48;
const GROUND_CHECK_END_MARGIN = 30;
const GROUND_CHECK_CLEARANCE = 0.5;

/** Finds the location under a point on screen, in normalised device coordinates. */
export type Picker = (ndcX: number, ndcY: number) => Location | null;

function locationOf(object: Object3D): Location | null {
  for (let at: Object3D | null = object; at; at = at.parent) {
    if (at.userData.location) {
      return at.userData.location as Location;
    }
  }
  return null;
}

/** Layers are drawn by polygon offset, so that is what decides which one shows. */
function drawnLayer(hit: Intersection): number {
  const material = (hit.object as Mesh).material as Material;
  return -material.polygonOffsetFactor;
}

/** Whether a hill stands between the camera and a point along the ray. */
function isBehindGround(ray: Ray, distance: number, surface: GroundSurface): boolean {
  const end = distance - GROUND_CHECK_END_MARGIN;
  const point = new Vector3();
  for (let step = 1; step <= GROUND_CHECK_STEPS; step += 1) {
    ray.at((end * step) / GROUND_CHECK_STEPS, point);
    if (surface.heightAt(point.x, point.z) > point.y + GROUND_CHECK_CLEARANCE) {
      return true;
    }
  }
  return false;
}

export function createPicker(precincts: Precincts, camera: Camera, surface: GroundSurface): Picker {
  const raycaster = new Raycaster();
  const pointer = new Vector2();

  return (ndcX, ndcY) => {
    pointer.set(ndcX, ndcY);
    raycaster.setFromCamera(pointer, camera);
    // Raycasts ignore an object's `visible` flag, so hidden precincts are left out here.
    const hits = raycaster.intersectObjects(precincts.shownObjects);
    if (hits.length === 0 || isBehindGround(raycaster.ray, hits[0].distance, surface)) {
      return null;
    }

    let best = hits[0];
    for (const hit of hits) {
      if (hit.distance - hits[0].distance > SAME_SURFACE_DISTANCE) {
        break;
      }
      if (drawnLayer(hit) > drawnLayer(best)) {
        best = hit;
      }
    }
    return locationOf(best.object);
  };
}
