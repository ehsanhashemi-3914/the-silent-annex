// Seeded, tileable noise fields. Because the same seed always gives the same result,
// every player sees identical "hand-painted" surfaces, and because the fields wrap at
// their edges, textures repeat across a wall without a visible seam.

export type Field = Float32Array;

/** A small, fast seeded random number generator (mulberry32). */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** Adds one octave of tiled value noise into `out`, with separate x and y periods. */
function addOctave(out: Field, size: number, periodX: number, periodY: number, amplitude: number, rng: () => number) {
  const lattice = new Float32Array(periodX * periodY);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng();
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * periodY;
    const iy = Math.floor(fy);
    const ty = smooth(fy - iy);
    const row0 = (iy % periodY) * periodX;
    const row1 = ((iy + 1) % periodY) * periodX;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * periodX;
      const ix = Math.floor(fx);
      const tx = smooth(fx - ix);
      const col0 = ix % periodX;
      const col1 = (ix + 1) % periodX;
      const top = lattice[row0 + col0] * (1 - tx) + lattice[row0 + col1] * tx;
      const bottom = lattice[row1 + col0] * (1 - tx) + lattice[row1 + col1] * tx;
      out[y * size + x] += (top * (1 - ty) + bottom * ty) * amplitude;
    }
  }
}

function normalize(field: Field): Field {
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < field.length; i++) {
    if (field[i] < min) min = field[i];
    if (field[i] > max) max = field[i];
  }
  const range = max - min || 1;
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - min) / range;
  return field;
}

export interface FbmOptions {
  period?: number;
  periodX?: number;
  periodY?: number;
  octaves?: number;
  persistence?: number;
  seed?: number;
}

/** Fractal noise from 0 to 1. Unequal x and y periods produce streaks such as wood grain. */
export function fbm(size: number, options: FbmOptions = {}): Field {
  const { period = 4, octaves = 5, persistence = 0.5, seed = 1 } = options;
  const rng = createRng(seed);
  const out = new Float32Array(size * size);
  let px = options.periodX ?? period;
  let py = options.periodY ?? period;
  let amplitude = 1;
  for (let i = 0; i < octaves; i++) {
    if (px > size / 2 || py > size / 2) break;
    addOctave(out, size, px, py, amplitude, rng);
    px *= 2;
    py *= 2;
    amplitude *= persistence;
  }
  return normalize(out);
}

/** Thin bright lines where the noise crosses its midpoint: cracks, veins and rock seams. */
export function ridged(size: number, options: FbmOptions = {}): Field {
  const base = fbm(size, options);
  for (let i = 0; i < base.length; i++) base[i] = 1 - Math.abs(base[i] * 2 - 1);
  return base;
}

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
