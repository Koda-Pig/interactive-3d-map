import type { Texture } from "three";
import {
  Box3,
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  Group,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshLambertMaterial,
  RGBAFormat,
  Sphere,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
} from "three";
import { createFieldDetailTexture } from "../draw/textures.ts";
import { sliceOver, sliceStart, yieldToBrowser } from "../pace.ts";
import { GROUND_HALF_SIZE, MAP_HALF_SIZE } from "../site.ts";
import { writeFieldColor } from "./fields.ts";
import { heightAt } from "./height.ts";

const DETAIL_STEP = 20;
const MAX_STEP = 400;
const STEP_GROWTH = 1.12;

/**
 * Grid line positions along one axis: even across the map, then widening
 * towards the edge of the ground. Using the same lines on both axes keeps the
 * mesh free of cracks between fine and coarse cells.
 */
function buildGridLines(): Float64Array {
  const positive: number[] = [];
  for (let at = 0; at < MAP_HALF_SIZE; at += DETAIL_STEP) {
    positive.push(at);
  }

  let at = positive[positive.length - 1];
  let step = DETAIL_STEP;
  while (at + step < GROUND_HALF_SIZE) {
    at += step;
    positive.push(at);
    step = Math.min(MAX_STEP, step * STEP_GROWTH);
  }
  positive.push(GROUND_HALF_SIZE);

  const negative = positive
    .slice(1)
    .reverse()
    .map((value) => -value);
  return Float64Array.from([...negative, ...positive]);
}

/** Largest index whose grid line is at or before `value`, kept inside the grid. */
function lineBefore(lines: Float64Array, value: number): number {
  let low = 0;
  let high = lines.length - 2;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (lines[middle] <= value) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low;
}

/**
 * The height of the triangles actually drawn. Ribbons use this instead of
 * `heightAt` so the ground can't poke through them between mesh vertices.
 */
export class GroundSurface {
  private readonly count: number;

  constructor(
    private readonly lines: Float64Array,
    private readonly heights: Float32Array,
  ) {
    this.count = lines.length;
  }

  heightAt(x: number, z: number): number {
    const { lines, heights, count } = this;
    const column = lineBefore(lines, x);
    const row = lineBefore(lines, z);
    const u = (x - lines[column]) / (lines[column + 1] - lines[column]);
    const v = (z - lines[row]) / (lines[row + 1] - lines[row]);

    const a = heights[row * count + column];
    const b = heights[row * count + column + 1];
    const c = heights[(row + 1) * count + column];
    const d = heights[(row + 1) * count + column + 1];

    // Matches the diagonal used by the mesh indices.
    return u + v <= 1 ? a + (b - a) * u + (c - a) * v : d + (c - d) * (1 - u) + (b - d) * (1 - v);
  }
}

async function sampleHeights(lines: Float64Array): Promise<Float32Array> {
  const count = lines.length;
  const heights = new Float32Array(count * count);
  let slice = sliceStart();
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      heights[row * count + column] = heightAt(lines[column], lines[row]);
    }
    if (sliceOver(slice)) {
      await yieldToBrowser();
      slice = sliceStart();
    }
  }
  return heights;
}

/**
 * How many grid cells one piece of the ground spans each way. The ground is
 * drawn in pieces so that the ones out of view can be skipped. Smaller pieces
 * skip more triangles but cost more draw calls when the whole site is in view.
 */
const PIECE_CELLS = 48;

/**
 * One piece of the ground: the same vertices as the whole, with the triangles
 * of a block of cells. Its bounds are set by hand, because the ones a
 * geometry works out for itself would cover every vertex.
 */
function pieceGeometry(
  whole: BufferGeometry,
  lines: Float64Array,
  heights: Float32Array,
  firstColumn: number,
  firstRow: number,
): BufferGeometry {
  const count = lines.length;
  const lastColumn = Math.min(firstColumn + PIECE_CELLS, count - 1);
  const lastRow = Math.min(firstRow + PIECE_CELLS, count - 1);
  const indices = new Uint32Array((lastColumn - firstColumn) * (lastRow - firstRow) * 6);
  let next = 0;
  for (let row = firstRow; row < lastRow; row += 1) {
    for (let column = firstColumn; column < lastColumn; column += 1) {
      const a = row * count + column;
      const b = a + 1;
      const c = a + count;
      const d = c + 1;
      indices.set([a, c, b, b, c, d], next);
      next += 6;
    }
  }

  let lowest = Number.POSITIVE_INFINITY;
  let highest = Number.NEGATIVE_INFINITY;
  for (let row = firstRow; row <= lastRow; row += 1) {
    for (let column = firstColumn; column <= lastColumn; column += 1) {
      const height = heights[row * count + column];
      lowest = Math.min(lowest, height);
      highest = Math.max(highest, height);
    }
  }

  const geometry = new BufferGeometry();
  for (const name of ["position", "uv", "normal"]) {
    geometry.setAttribute(name, whole.getAttribute(name));
  }
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.boundingBox = new Box3(
    new Vector3(lines[firstColumn], lowest, lines[firstRow]),
    new Vector3(lines[lastColumn], highest, lines[lastRow]),
  );
  geometry.boundingSphere = geometry.boundingBox.getBoundingSphere(new Sphere());
  return geometry;
}

async function buildGeometry(lines: Float64Array, heights: Float32Array): Promise<BufferGeometry> {
  const count = lines.length;
  const last = count - 1;
  const positions = new Float32Array(count * count * 3);
  const uvs = new Float32Array(count * count * 2);
  const indices = new Uint32Array(last * last * 6);

  let slice = sliceStart();
  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      const vertex = row * count + column;
      positions[vertex * 3] = lines[column];
      positions[vertex * 3 + 1] = heights[vertex];
      positions[vertex * 3 + 2] = lines[row];
      uvs[vertex * 2] = column / last;
      uvs[vertex * 2 + 1] = row / last;
    }
    if (sliceOver(slice)) {
      await yieldToBrowser();
      slice = sliceStart();
    }
  }

  for (let row = 0; row < last; row += 1) {
    for (let column = 0; column < last; column += 1) {
      const a = row * count + column;
      const b = a + 1;
      const c = a + count;
      const d = c + 1;
      indices.set([a, c, b, b, c, d], (row * last + column) * 6);
    }
    if (sliceOver(slice)) {
      await yieldToBrowser();
      slice = sliceStart();
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new BufferAttribute(uvs, 2));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Bakes the farmland colours. Texture coordinates follow the grid lines, so
 * most of the texels land on the map, where the camera spends its time.
 */
async function bakeFieldTexture(lines: Float64Array, size: number): Promise<DataTexture> {
  const last = lines.length - 1;
  const worldAtTexel = new Float64Array(size);
  for (let texel = 0; texel < size; texel += 1) {
    const position = ((texel + 0.5) / size) * last;
    const line = Math.floor(position);
    worldAtTexel[texel] = lines[line] + (lines[line + 1] - lines[line]) * (position - line);
  }

  const pixels = new Uint8Array(size * size * 4);
  let slice = sliceStart();
  for (let row = 0; row < size; row += 1) {
    for (let column = 0; column < size; column += 1) {
      writeFieldColor(worldAtTexel[column], worldAtTexel[row], pixels, (row * size + column) * 4);
    }
    if (sliceOver(slice)) {
      await yieldToBrowser();
      slice = sliceStart();
    }
  }

  const texture = new DataTexture(pixels, size, size, RGBAFormat, UnsignedByteType);
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

const CROP_ROW_TILE = 24;
const CROP_SWATH_TILE = 170;

/** Adds crop rows and speckle to the baked colours, sampled in metres. */
function addFieldDetail(material: MeshLambertMaterial, detail: Texture): void {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.fieldDetail = { value: detail };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vGroundXZ;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGroundXZ = position.xz;");
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        "#include <common>\nvarying vec2 vGroundXZ;\nuniform sampler2D fieldDetail;",
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
        float rowsCode = sampledDiffuseColor.a;
        vec2 rowsXZ = rowsCode < 0.5 ? vGroundXZ : vGroundXZ.yx;
        vec4 nearDetail = texture2D(fieldDetail, rowsXZ / ${CROP_ROW_TILE.toFixed(1)});
        vec4 farDetail = texture2D(fieldDetail, rowsXZ / ${CROP_SWATH_TILE.toFixed(1)});
        float rowsAmount = abs(rowsCode - 0.5) * 2.0;
        float rows = 2.0 * mix(0.5, 0.65 * nearDetail.r + 0.35 * farDetail.r, rowsAmount);
        diffuseColor.rgb *= rows * (0.6 + 0.8 * nearDetail.g) * (0.82 + 0.36 * farDetail.g);`,
      );
  };
}

export async function createGround(
  maxAnisotropy: number,
  textureSize: number,
): Promise<{ mesh: Group; surface: GroundSurface }> {
  const lines = buildGridLines();
  const heights = await sampleHeights(lines);
  const map = await bakeFieldTexture(lines, textureSize);
  map.anisotropy = maxAnisotropy;

  const material = new MeshLambertMaterial({ map });
  addFieldDetail(material, createFieldDetailTexture(maxAnisotropy));

  const whole = await buildGeometry(lines, heights);
  const mesh = new Group();
  mesh.name = "ground";
  let slice = sliceStart();
  for (let row = 0; row < lines.length - 1; row += PIECE_CELLS) {
    for (let column = 0; column < lines.length - 1; column += PIECE_CELLS) {
      const piece = new Mesh(pieceGeometry(whole, lines, heights, column, row), material);
      piece.receiveShadow = true;
      mesh.add(piece);
    }
    if (sliceOver(slice)) {
      await yieldToBrowser();
      slice = sliceStart();
    }
  }
  return { mesh, surface: new GroundSurface(lines, heights) };
}
