import { CylinderGeometry, Group, Mesh, SphereGeometry } from "three";
import type { GateLocation } from "../layout/locations.ts";
import { heightAt } from "../terrain/height.ts";
import { solidMaterial } from "./materials.ts";

const POST_HEIGHT = 16;
const POST_COLOR = "#004272";
const CAP_COLOR = "#00678C";

const postGeometry = new CylinderGeometry(2.5, 4, POST_HEIGHT, 12);
const capGeometry = new SphereGeometry(7, 16, 12);

export function createGate(location: GateLocation): Group {
  const [x, z] = location.position;
  const ground = heightAt(x, z);

  const post = new Mesh(postGeometry, solidMaterial(POST_COLOR));
  post.position.set(x, ground + POST_HEIGHT / 2, z);
  const cap = new Mesh(capGeometry, solidMaterial(CAP_COLOR));
  cap.position.set(x, ground + POST_HEIGHT + 5, z);

  const group = new Group();
  for (const part of [post, cap]) {
    part.castShadow = true;
    group.add(part);
  }
  return group;
}
