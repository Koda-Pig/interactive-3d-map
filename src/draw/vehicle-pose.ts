import { type BufferGeometry, type Object3D, Vector3 } from "three";

/** Pitch and roll from the tyre contact spans, with the nose along local +Z. */
export function vehicleSlope(
  heightAt: (x: number, z: number) => number,
  x: number,
  z: number,
  yaw: number,
) {
  const forwardX = Math.sin(yaw);
  const forwardZ = Math.cos(yaw);
  const front = heightAt(x + forwardX * 1.7, z + forwardZ * 1.7);
  const rear = heightAt(x - forwardX * 1.7, z - forwardZ * 1.7);
  const right = heightAt(x + forwardZ * 0.81, z - forwardX * 0.81);
  const left = heightAt(x - forwardZ * 0.81, z + forwardX * 0.81);
  return {
    pitch: -Math.atan2(front - rear, 3.4),
    tilt: Math.atan2(right - left, 1.62),
  };
}

/** Tyre bottom vertices from the exported model, including both tread edges. */
export function tyreContacts(geometry: BufferGeometry): Vector3[] {
  const position = geometry.getAttribute("position");
  const contacts = new Map<string, Vector3>();
  for (let vertex = 0; vertex < position.count; vertex++) {
    if (position.getY(vertex) > 0.0001) continue;
    const point = new Vector3().fromBufferAttribute(position, vertex);
    contacts.set(point.toArray().join(), point);
  }
  return [...contacts.values()];
}

/** Seat the rigid tyre contact plane on the road without letting a tyre penetrate it. */
export function seatVehicle(
  object: Object3D,
  heightAt: (x: number, z: number) => number,
  contacts: readonly Vector3[],
): void {
  if (contacts.length === 0) return;
  // Fit a plane to all tread edges, rather than sampling only the axle midpoints.
  // This shares a road crease across the four tyres instead of balancing on it.
  const yaw = object.rotation.y;
  const sin = Math.sin(yaw),
    cos = Math.cos(yaw);
  const meanX = contacts.reduce((sum, p) => sum + p.x, 0) / contacts.length;
  const meanZ = contacts.reduce((sum, p) => sum + p.z, 0) / contacts.length;
  let xx = 0,
    zz = 0,
    xz = 0,
    xy = 0,
    zy = 0;
  for (const point of contacts) {
    const x = point.x - meanX,
      z = point.z - meanZ;
    const y = heightAt(
      object.position.x + cos * point.x + sin * point.z,
      object.position.z - sin * point.x + cos * point.z,
    );
    xx += x * x;
    zz += z * z;
    xz += x * z;
    xy += x * y;
    zy += z * y;
  }
  const determinant = xx * zz - xz * xz;
  if (determinant > 1e-10) {
    const across = (xy * zz - zy * xz) / determinant;
    const along = (zy * xx - xy * xz) / determinant;
    const pitch = -Math.atan(along);
    object.rotation.set(pitch, yaw, Math.atan(across * Math.cos(pitch)), "YXZ");
  }
  object.updateMatrix();
  let lift = Number.NEGATIVE_INFINITY;
  for (const contact of contacts) {
    const point = contact.clone().applyMatrix4(object.matrix);
    lift = Math.max(lift, heightAt(point.x, point.z) - point.y);
  }
  if (Number.isFinite(lift)) object.position.y += lift + 0.002;
}
