import {
  BufferAttribute,
  BufferGeometry,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  MeshLambertMaterial,
  RGBAFormat,
  SRGBColorSpace,
  UnsignedByteType,
} from "three";
import { GROUND_HALF_SIZE, MAP_HALF_SIZE } from "../site.ts";
import { writeFieldColor } from "./fields.ts";
import { heightAt } from "./height.ts";

const DETAIL_STEP = 20;
const MAX_STEP = 400;
const STEP_GROWTH = 1.12;
const TEXTURE_SIZE = 2048;

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

  const negative = positive.slice(1).reverse().map((value) => -value);
  return Float64Array.from([...negative, ...positive]);
}

function buildGeometry(lines: Float64Array): BufferGeometry {
  const count = lines.length;
  const last = count - 1;
  const positions = new Float32Array(count * count * 3);
  const uvs = new Float32Array(count * count * 2);
  const indices = new Uint32Array(last * last * 6);

  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      const vertex = row * count + column;
      const x = lines[column];
      const z = lines[row];
      positions[vertex * 3] = x;
      positions[vertex * 3 + 1] = heightAt(x, z);
      positions[vertex * 3 + 2] = z;
      uvs[vertex * 2] = column / last;
      uvs[vertex * 2 + 1] = row / last;
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
function bakeFieldTexture(lines: Float64Array): DataTexture {
  const last = lines.length - 1;
  const worldAtTexel = new Float64Array(TEXTURE_SIZE);
  for (let texel = 0; texel < TEXTURE_SIZE; texel += 1) {
    const position = ((texel + 0.5) / TEXTURE_SIZE) * last;
    const line = Math.floor(position);
    worldAtTexel[texel] = lines[line] + (lines[line + 1] - lines[line]) * (position - line);
  }

  const pixels = new Uint8Array(TEXTURE_SIZE * TEXTURE_SIZE * 4);
  for (let row = 0; row < TEXTURE_SIZE; row += 1) {
    for (let column = 0; column < TEXTURE_SIZE; column += 1) {
      const offset = (row * TEXTURE_SIZE + column) * 4;
      writeFieldColor(worldAtTexel[column], worldAtTexel[row], pixels, offset);
      pixels[offset + 3] = 255;
    }
  }

  const texture = new DataTexture(
    pixels,
    TEXTURE_SIZE,
    TEXTURE_SIZE,
    RGBAFormat,
    UnsignedByteType,
  );
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

export function createGround(maxAnisotropy: number): Mesh {
  const lines = buildGridLines();
  const map = bakeFieldTexture(lines);
  map.anisotropy = maxAnisotropy;

  const ground = new Mesh(buildGeometry(lines), new MeshLambertMaterial({ map }));
  ground.name = "ground";
  ground.receiveShadow = true;
  return ground;
}
