// Builds the crowd figures from Kenney's Mini Characters (CC0, www.kenney.nl).
//
// Each source character is a rigged, textured model of about 800 triangles,
// with its arms out in its rest pose. This poses it as the first frame of its
// "idle" animation, takes each face's colour from the texture atlas, scales it
// to adult height, simplifies it to about 150 triangles and bakes ambient
// occlusion into it. The result is a kit-style GLB: one primitive per colour,
// with the shade in COLOR_0, which the map multiplies by the material colour.
//
//   pnpm assets:people
//
// Sources are read from tools/assets/sources/kenney-mini-characters, and the
// figures are written to public/models/people, which the kit validator skips.

import { mkdir, readFile, rm } from "node:fs/promises";
import { inflateSync } from "node:zlib";
import { Document, NodeIO } from "@gltf-transform/core";
import { MeshoptSimplifier } from "meshoptimizer";
import * as THREE from "three";
import { bakeOcclusion } from "./occlusion.mjs";

const SOURCE = "tools/assets/sources/kenney-mini-characters";
const OUTPUT = "public/models/people";
/** The figures used, by source file name. */
export const PEOPLE = [
  "character-female-a",
  "character-female-c",
  "character-female-e",
  "character-male-a",
  "character-male-c",
  "character-male-e",
];
/** Every figure is scaled by the same amount, so their heights still differ a little. */
const SCALE = 2.55;
const TARGET_TRIANGLES = 150;
/** The largest change in shape the simplifier may make, as a share of the figure's size. */
const TARGET_ERROR = 0.12;
const POSE = "idle";

/** Reads an 8-bit PNG (greyscale, RGB, palette or RGBA, not interlaced) into RGBA pixels. */
function decodePng(bytes) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let type = 0;
  let palette = null;
  let alpha = null;
  const data = [];
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset);
    const kind = bytes.toString("ascii", offset + 4, offset + 8);
    const chunk = bytes.subarray(offset + 8, offset + 8 + length);
    if (kind === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      if (chunk[8] !== 8 || chunk[12] !== 0) {
        throw new Error("Only 8-bit, non-interlaced PNGs are supported");
      }
      type = chunk[9];
    } else if (kind === "PLTE") {
      palette = chunk;
    } else if (kind === "tRNS") {
      alpha = chunk;
    } else if (kind === "IDAT") {
      data.push(chunk);
    }
    offset += 12 + length;
  }
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type];
  const raw = inflateSync(Buffer.concat(data));
  const stride = width * channels;
  const rows = Buffer.alloc(height * stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x];
      const left = x >= channels ? rows[y * stride + x - channels] : 0;
      const up = y > 0 ? rows[(y - 1) * stride + x] : 0;
      const corner = x >= channels && y > 0 ? rows[(y - 1) * stride + x - channels] : 0;
      let predicted = 0;
      if (filter === 1) predicted = left;
      else if (filter === 2) predicted = up;
      else if (filter === 3) predicted = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - corner;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - corner);
        predicted = pa <= pb && pa <= pc ? left : pb <= pc ? up : corner;
      }
      rows[y * stride + x] = (value + predicted) & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const at = pixel * channels;
    let rgb;
    let a = 255;
    if (type === 3) {
      const index = rows[at];
      rgb = [palette[index * 3], palette[index * 3 + 1], palette[index * 3 + 2]];
      a = alpha && index < alpha.length ? alpha[index] : 255;
    } else if (type === 0 || type === 4) {
      rgb = [rows[at], rows[at], rows[at]];
      a = type === 4 ? rows[at + 1] : 255;
    } else {
      rgb = [rows[at], rows[at + 1], rows[at + 2]];
      a = type === 6 ? rows[at + 3] : 255;
    }
    rgba.set([...rgb, a], pixel * 4);
  }
  return { width, height, rgba };
}

/** The JSON chunk of a GLB, for the texture transform gltf-transform doesn't read. */
function glbJson(bytes) {
  const length = bytes.readUInt32LE(12);
  return JSON.parse(bytes.toString("utf8", 20, 20 + length));
}

/** Puts every joint where the first frame of an animation puts it. */
function applyPose(document, name) {
  const animation = document
    .getRoot()
    .listAnimations()
    .find((candidate) => candidate.getName() === name);
  if (!animation) {
    throw new Error(`No "${name}" animation`);
  }
  for (const channel of animation.listChannels()) {
    const node = channel.getTargetNode();
    const output = channel.getSampler().getOutput();
    const value = output.getElement(0, []);
    const path = channel.getTargetPath();
    if (path === "translation") node.setTranslation(value);
    else if (path === "rotation") node.setRotation(value);
    else if (path === "scale") node.setScale(value);
  }
}

/** One posed triangle soup per character: positions and an sRGB colour per corner. */
function posedTriangles(document, json, atlas) {
  const transform =
    json.materials?.[0]?.pbrMetallicRoughness?.baseColorTexture?.extensions
      ?.KHR_texture_transform ?? {};
  const [offsetU, offsetV] = transform.offset ?? [0, 0];
  const [scaleU, scaleV] = transform.scale ?? [1, 1];
  const positions = [];
  const colors = [];
  const vertex = new THREE.Vector3();
  const skinned = new THREE.Vector3();
  const part = new THREE.Vector3();
  const joint = new THREE.Matrix4();
  const inverse = new THREE.Matrix4();

  for (const node of document.getRoot().listNodes()) {
    const mesh = node.getMesh();
    const skin = node.getSkin();
    if (!mesh) {
      continue;
    }
    const jointMatrices = skin
      ? skin.listJoints().map((jointNode, index) => {
          inverse.fromArray(skin.getInverseBindMatrices().getElement(index, []));
          return new THREE.Matrix4().fromArray(jointNode.getWorldMatrix()).multiply(inverse);
        })
      : null;
    const world = new THREE.Matrix4().fromArray(node.getWorldMatrix());
    for (const primitive of mesh.listPrimitives()) {
      const position = primitive.getAttribute("POSITION");
      const uv = primitive.getAttribute("TEXCOORD_0");
      const joints = primitive.getAttribute("JOINTS_0");
      const weights = primitive.getAttribute("WEIGHTS_0");
      const indices = primitive.getIndices();
      const count = indices ? indices.getCount() : position.getCount();
      const corner = (index) => {
        vertex.fromArray(position.getElement(index, []));
        if (jointMatrices && joints && weights) {
          const ids = joints.getElement(index, []);
          const amounts = weights.getElement(index, []);
          skinned.set(0, 0, 0);
          for (let k = 0; k < 4; k += 1) {
            if (amounts[k] > 0) {
              joint.copy(jointMatrices[ids[k]]);
              skinned.addScaledVector(part.copy(vertex).applyMatrix4(joint), amounts[k]);
            }
          }
          return skinned.clone();
        }
        return vertex.clone().applyMatrix4(world);
      };
      for (let face = 0; face < count; face += 3) {
        const corners = [0, 1, 2].map((k) => (indices ? indices.getScalar(face + k) : face + k));
        // The atlas is made of flat swatches, so the face's middle gives its colour.
        let u = 0;
        let v = 0;
        for (const index of corners) {
          const [cu, cv] = uv.getElement(index, []);
          u += cu / 3;
          v += cv / 3;
        }
        u = u * scaleU + offsetU;
        v = v * scaleV + offsetV;
        const x = Math.min(
          atlas.width - 1,
          Math.max(0, Math.floor((u - Math.floor(u)) * atlas.width)),
        );
        const y = Math.min(
          atlas.height - 1,
          Math.max(0, Math.floor((v - Math.floor(v)) * atlas.height)),
        );
        const at = (y * atlas.width + x) * 4;
        const rgb = [atlas.rgba[at], atlas.rgba[at + 1], atlas.rgba[at + 2]];
        for (const index of corners) {
          const p = corner(index);
          positions.push(p.x * SCALE, p.y * SCALE, p.z * SCALE);
          colors.push(...rgb);
        }
      }
    }
  }
  return { positions, colors };
}

/** Joins corners that share a position and colour, so the simplifier sees one surface. */
function weld({ positions, colors }) {
  const keys = new Map();
  const welded = [];
  const weldedColors = [];
  const indices = [];
  for (let corner = 0; corner < positions.length / 3; corner += 1) {
    const p = positions.slice(corner * 3, corner * 3 + 3);
    const c = colors.slice(corner * 3, corner * 3 + 3);
    const key = `${p.map((n) => n.toFixed(4)).join()}|${c.join()}`;
    let index = keys.get(key);
    if (index === undefined) {
      index = welded.length / 3;
      keys.set(key, index);
      welded.push(...p);
      weldedColors.push(...c);
    }
    indices.push(index);
  }
  return {
    positions: new Float32Array(welded),
    colors: weldedColors,
    indices: new Uint32Array(indices),
  };
}

function srgbToLinear(value) {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

async function buildFigure(io, atlas, name) {
  const path = `${SOURCE}/${name}.glb`;
  const bytes = await readFile(path);
  const document = await io.read(path);
  applyPose(document, POSE);
  const soup = posedTriangles(document, glbJson(bytes), atlas);

  // Stand it on the ground at its middle.
  let minY = Number.POSITIVE_INFINITY;
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;
  for (let i = 0; i < soup.positions.length; i += 3) {
    minX = Math.min(minX, soup.positions[i]);
    maxX = Math.max(maxX, soup.positions[i]);
    minY = Math.min(minY, soup.positions[i + 1]);
    minZ = Math.min(minZ, soup.positions[i + 2]);
    maxZ = Math.max(maxZ, soup.positions[i + 2]);
  }
  for (let i = 0; i < soup.positions.length; i += 3) {
    soup.positions[i] -= (minX + maxX) / 2;
    soup.positions[i + 1] -= minY;
    soup.positions[i + 2] -= (minZ + maxZ) / 2;
  }

  const mesh = weld(soup);
  const [simplified, error] = MeshoptSimplifier.simplify(
    mesh.indices,
    mesh.positions,
    3,
    TARGET_TRIANGLES * 3,
    TARGET_ERROR,
    // Colour borders would otherwise be kept as seams, and the figures barely simplify.
    ["Permissive"],
  );

  // One part per colour, as the kit's models have one per material.
  const byColor = new Map();
  for (let face = 0; face < simplified.length; face += 3) {
    const first = simplified[face];
    const key = mesh.colors.slice(first * 3, first * 3 + 3).join();
    if (!byColor.has(key)) byColor.set(key, []);
    const list = byColor.get(key);
    for (let k = 0; k < 3; k += 1) {
      const index = simplified[face + k];
      list.push(
        mesh.positions[index * 3],
        mesh.positions[index * 3 + 1],
        mesh.positions[index * 3 + 2],
      );
    }
  }
  const parts = [...byColor].map(([key, corners]) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(corners, 3));
    g.computeVertexNormals();
    return { key, g };
  });
  bakeOcclusion(parts, { tileable: false });

  const out = new Document();
  const buffer = out.createBuffer();
  const scene = out.createScene(name);
  const node = out.createNode(name);
  const outMesh = out.createMesh(name);
  for (const [index, { key, g }] of parts.entries()) {
    const [r, gr, b] = key.split(",").map(Number);
    const material = out
      .createMaterial(`colour-${index}`)
      .setBaseColorFactor([srgbToLinear(r), srgbToLinear(gr), srgbToLinear(b), 1])
      .setRoughnessFactor(0.9)
      .setMetallicFactor(0);
    const attribute = (semantic, source, size) =>
      out
        .createAccessor(`${semantic}-${index}`)
        .setType(size === 3 ? "VEC3" : "VEC4")
        .setArray(new Float32Array(source.array))
        .setBuffer(buffer);
    const shade = g.getAttribute("color");
    const color = new Float32Array(shade.count * 4);
    for (let v = 0; v < shade.count; v += 1) {
      color.set([shade.getX(v), shade.getY(v), shade.getZ(v), 1], v * 4);
    }
    outMesh.addPrimitive(
      out
        .createPrimitive()
        .setAttribute("POSITION", attribute("POSITION", g.getAttribute("position"), 3))
        .setAttribute("NORMAL", attribute("NORMAL", g.getAttribute("normal"), 3))
        .setAttribute(
          "COLOR_0",
          out.createAccessor(`COLOR_0-${index}`).setType("VEC4").setArray(color).setBuffer(buffer),
        )
        .setMaterial(material),
    );
  }
  node.setMesh(outMesh);
  scene.addChild(node);
  out.getRoot().getAsset().generator = "interactive-3d-map people.mjs";
  await io.write(`${OUTPUT}/${name.replace("character-", "person-")}.glb`, out);
  return {
    name,
    triangles: simplified.length / 3,
    source: mesh.indices.length / 3,
    height: Math.max(...parts.flatMap(({ g }) => [g.boundingBox?.max.y ?? 0])),
    error,
  };
}

await MeshoptSimplifier.ready;
const atlas = decodePng(await readFile(`${SOURCE}/Textures/colormap.png`));
const io = new NodeIO();
await rm(OUTPUT, { recursive: true, force: true });
await mkdir(OUTPUT, { recursive: true });
for (const name of PEOPLE) {
  const result = await buildFigure(io, atlas, name);
  console.log(
    `${result.name}: ${result.source} -> ${result.triangles} triangles, error ${result.error.toFixed(4)}`,
  );
}
