/** Deterministic hash of a lattice point, in the range [0, 1). */
export function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 0x27d4eb2d) ^ Math.imul(iz, 0x165667b1) ^ Math.imul(seed, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Smooth value noise in the range [-1, 1]. One lattice cell spans `wavelength`
 * metres. Each seed turns the lattice to a different angle, so layered noise
 * doesn't line up along the world axes.
 */
export function noise2(x: number, z: number, wavelength: number, seed: number): number {
  const angle = seed * 2.399963;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const u = (x * cos - z * sin) / wavelength;
  const v = (x * sin + z * cos) / wavelength;

  const iu = Math.floor(u);
  const iv = Math.floor(v);
  const fu = fade(u - iu);
  const fv = fade(v - iv);

  const a = hash2(iu, iv, seed);
  const b = hash2(iu + 1, iv, seed);
  const c = hash2(iu, iv + 1, seed);
  const d = hash2(iu + 1, iv + 1, seed);
  const near = a + (b - a) * fu;
  const far = c + (d - c) * fu;
  return (near + (far - near) * fv) * 2 - 1;
}
