import type { BufferGeometry } from "three";

/** Spatially indexed heights on the exact triangles used to draw a road. */
export class TriangleSurface {
  private readonly cells = new Map<string, number[]>();
  private readonly position;
  private readonly index;
  private readonly cellSize = 20;

  constructor(geometry: BufferGeometry) {
    this.position = geometry.getAttribute("position");
    const index = geometry.getIndex();
    if (!index) throw new Error("Road surface must have indexed triangles");
    this.index = index;
    for (let triangle = 0; triangle < this.index.count; triangle += 3) {
      const vertices = [0, 1, 2].map((corner) => this.index.getX(triangle + corner));
      const xs = vertices.map((v) => this.position.getX(v));
      const zs = vertices.map((v) => this.position.getZ(v));
      for (
        let x = Math.floor(Math.min(...xs) / this.cellSize);
        x <= Math.floor(Math.max(...xs) / this.cellSize);
        x++
      ) {
        for (
          let z = Math.floor(Math.min(...zs) / this.cellSize);
          z <= Math.floor(Math.max(...zs) / this.cellSize);
          z++
        ) {
          const key = `${x},${z}`;
          const triangles = this.cells.get(key) ?? [];
          triangles.push(triangle);
          this.cells.set(key, triangles);
        }
      }
    }
  }

  heightAt(x: number, z: number): number {
    const key = `${Math.floor(x / this.cellSize)},${Math.floor(z / this.cellSize)}`;
    for (const triangle of this.cells.get(key) ?? []) {
      const a = this.index.getX(triangle),
        b = this.index.getX(triangle + 1),
        c = this.index.getX(triangle + 2);
      const ax = this.position.getX(a),
        az = this.position.getZ(a);
      const bx = this.position.getX(b) - ax,
        bz = this.position.getZ(b) - az;
      const cx = this.position.getX(c) - ax,
        cz = this.position.getZ(c) - az;
      const det = bx * cz - bz * cx;
      if (Math.abs(det) < 1e-10) continue;
      const u = ((x - ax) * cz - (z - az) * cx) / det;
      const v = (bx * (z - az) - bz * (x - ax)) / det;
      if (u >= -1e-6 && v >= -1e-6 && u + v <= 1 + 1e-6) {
        return (
          this.position.getY(a) * (1 - u - v) +
          this.position.getY(b) * u +
          this.position.getY(c) * v
        );
      }
    }
    throw new Error(`No road surface at ${x}, ${z}`);
  }
}
