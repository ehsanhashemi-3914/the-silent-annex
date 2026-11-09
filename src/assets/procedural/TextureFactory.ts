// Paints every surface texture in code. For each surface a painter fills three arrays
// (colour, height, roughness), and a normal map is derived from the height. No image
// files are involved, so all of the game's art here is original and takes no download.

import * as THREE from 'three';
import { clamp01, createRng, fbm, lerp, ridged, smoothstep, type Field } from './Noise';

export interface TextureSet {
  map: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
}

/** The buffers a painter writes into. Height and roughness range from 0 to 1. */
export interface Canvas {
  size: number;
  r: Field;
  g: Field;
  b: Field;
  height: Field;
  rough: Field;
}

type Rgb = readonly [number, number, number];

function createCanvas(size: number): Canvas {
  const n = size * size;
  return {
    size,
    r: new Float32Array(n),
    g: new Float32Array(n),
    b: new Float32Array(n),
    height: new Float32Array(n),
    rough: new Float32Array(n),
  };
}

function hex(value: number): Rgb {
  return [((value >> 16) & 255) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}

function dataTexture(data: Uint8Array, size: number, srgb: boolean): THREE.DataTexture {
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/** Turns painted buffers into GPU textures, deriving the normal map from the height. */
function toTextureSet(canvas: Canvas, normalStrength: number): TextureSet {
  const { size, r, g, b, height, rough } = canvas;
  const n = size * size;
  const color = new Uint8Array(n * 4);
  const normal = new Uint8Array(n * 4);
  const roughness = new Uint8Array(n * 4);
  for (let y = 0; y < size; y++) {
    const up = ((y + size - 1) % size) * size;
    const down = ((y + 1) % size) * size;
    const row = y * size;
    for (let x = 0; x < size; x++) {
      const i = row + x;
      const o = i * 4;
      color[o] = clamp01(r[i]) * 255;
      color[o + 1] = clamp01(g[i]) * 255;
      color[o + 2] = clamp01(b[i]) * 255;
      color[o + 3] = 255;

      const left = height[row + ((x + size - 1) % size)];
      const right = height[row + ((x + 1) % size)];
      const dx = (left - right) * normalStrength;
      const dy = (height[up + x] - height[down + x]) * normalStrength;
      const length = Math.sqrt(dx * dx + dy * dy + 1);
      normal[o] = (dx / length) * 127.5 + 127.5;
      normal[o + 1] = (dy / length) * 127.5 + 127.5;
      normal[o + 2] = (1 / length) * 127.5 + 127.5;
      normal[o + 3] = 255;

      // Three.js reads roughness from the green channel.
      const value = clamp01(rough[i]) * 255;
      roughness[o] = value;
      roughness[o + 1] = value;
      roughness[o + 2] = value;
      roughness[o + 3] = 255;
    }
  }
  return {
    map: dataTexture(color, size, true),
    normalMap: dataTexture(normal, size, false),
    roughnessMap: dataTexture(roughness, size, false),
  };
}

function fill(canvas: Canvas, painter: (i: number, x: number, y: number) => void): void {
  const { size } = canvas;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) painter(y * size + x, x, y);
  }
}

function setColor(canvas: Canvas, i: number, color: Rgb, shade = 1): void {
  canvas.r[i] = color[0] * shade;
  canvas.g[i] = color[1] * shade;
  canvas.b[i] = color[2] * shade;
}

function mixColor(a: Rgb, b: Rgb, t: number): Rgb {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/** Stamps a filled disc into the buffers, wrapping at the edges. */
function stampDisc(canvas: Canvas, cx: number, cy: number, radius: number, apply: (i: number, t: number) => void) {
  const { size } = canvas;
  const reach = Math.ceil(radius);
  for (let oy = -reach; oy <= reach; oy++) {
    for (let ox = -reach; ox <= reach; ox++) {
      const d = Math.sqrt(ox * ox + oy * oy);
      if (d > radius) continue;
      const x = (Math.floor(cx) + ox + size) % size;
      const y = (Math.floor(cy) + oy + size) % size;
      apply(y * size + x, d / radius);
    }
  }
}

// Concrete and masonry

/** Board-marked concrete, with the plank lines and tie holes left by timber formwork. */
function concreteBoard(size: number, base: Rgb, seed: number): Canvas {
  const canvas = createCanvas(size);
  const planks = 6;
  const grain = fbm(size, { periodX: 3, periodY: 48, octaves: 4, seed });
  const mottle = fbm(size, { period: 3, octaves: 5, seed: seed + 1 });
  const pits = fbm(size, { period: 64, octaves: 2, seed: seed + 2 });
  const rng = createRng(seed + 3);
  const plankTone = Array.from({ length: planks }, () => 0.86 + rng() * 0.24);
  const plankShift = Array.from({ length: planks }, () => Math.floor(rng() * size));
  fill(canvas, (i, x, y) => {
    const v = (y / size) * planks;
    const plank = Math.floor(v);
    const within = v - plank;
    const seam = smoothstep(0.03, 0, Math.min(within, 1 - within));
    const shiftedGrain = grain[y * size + ((x + plankShift[plank]) % size)];
    const pit = smoothstep(0.82, 0.92, pits[i]);
    const shade = plankTone[plank] * (0.78 + mottle[i] * 0.34) * (0.92 + shiftedGrain * 0.16) * (1 - seam * 0.5) * (1 - pit * 0.35);
    setColor(canvas, i, base, shade);
    canvas.height[i] = 0.5 + shiftedGrain * 0.22 - seam * 0.5 - pit * 0.25;
    canvas.rough[i] = 0.82 + mottle[i] * 0.16;
  });
  // Tie holes in a regular pattern, a hallmark of poured brutalist concrete.
  for (let ty = 0; ty < 2; ty++) {
    for (let tx = 0; tx < 2; tx++) {
      stampDisc(canvas, ((tx + 0.5) / 2) * size, ((ty + 0.5) / 2) * size, size * 0.012, (i, t) => {
        canvas.height[i] -= 0.5 * (1 - t);
        canvas.r[i] *= 0.45;
        canvas.g[i] *= 0.45;
        canvas.b[i] *= 0.45;
      });
    }
  }
  return canvas;
}

function concreteSmooth(size: number, base: Rgb, seed: number): Canvas {
  const canvas = createCanvas(size);
  const mottle = fbm(size, { period: 3, octaves: 6, seed });
  const fine = fbm(size, { period: 48, octaves: 3, seed: seed + 1 });
  const cracks = ridged(size, { period: 3, octaves: 4, seed: seed + 2 });
  fill(canvas, (i) => {
    const crack = smoothstep(0.991, 0.999, cracks[i]);
    const shade = (0.72 + mottle[i] * 0.42) * (0.94 + fine[i] * 0.12) * (1 - crack * 0.3);
    setColor(canvas, i, base, shade);
    canvas.height[i] = 0.5 + fine[i] * 0.25 + mottle[i] * 0.1 - crack * 0.3;
    canvas.rough[i] = 0.74 + mottle[i] * 0.2;
  });
  return canvas;
}

function rock(size: number, seed: number): Canvas {
  const canvas = createCanvas(size);
  const big = fbm(size, { period: 3, octaves: 7, persistence: 0.58, seed });
  const seams = ridged(size, { period: 4, octaves: 5, seed: seed + 1 });
  fill(canvas, (i) => {
    const seam = smoothstep(0.93, 0.995, seams[i]);
    const tone = mixColor(hex(0x3c3a38), hex(0x74706a), big[i]);
    setColor(canvas, i, tone, 1 - seam * 0.14);
    canvas.height[i] = big[i] * 0.85 - seam * 0.1;
    canvas.rough[i] = 0.88 + big[i] * 0.1;
  });
  return canvas;
}

// Painted walls

/** Wall paint: mostly even colour, faintly mottled, with chips showing what's underneath. */
function paint(size: number, base: Rgb, under: Rgb, seed: number, chipAmount = 0.5): Canvas {
  const canvas = createCanvas(size);
  const mottle = fbm(size, { period: 2, octaves: 6, seed });
  const orange = fbm(size, { period: 64, octaves: 2, seed: seed + 1 });
  const chipMask = fbm(size, { period: 6, octaves: 6, persistence: 0.62, seed: seed + 2 });
  // Chips are kept rare and close to the wall colour. Strong dark blotches would repeat
  // every couple of metres and give the texture away at once.
  const threshold = lerp(0.97, 0.86, chipAmount);
  const softUnder = mixColor(base, under, 0.55);
  fill(canvas, (i) => {
    const chip = smoothstep(threshold, threshold + 0.03, chipMask[i]);
    const tone = mixColor(base, softUnder, chip);
    setColor(canvas, i, tone, (0.86 + mottle[i] * 0.22) * (1 - smoothstep(threshold - 0.04, threshold, chipMask[i]) * 0.05));
    canvas.height[i] = 0.5 + orange[i] * 0.12 - chip * 0.3;
    canvas.rough[i] = lerp(0.58 + mottle[i] * 0.16, 0.9, chip);
  });
  return canvas;
}

// Floors

function terrazzo(size: number, seed: number): Canvas {
  const canvas = createCanvas(size);
  const rng = createRng(seed);
  const mottle = fbm(size, { period: 3, octaves: 4, seed: seed + 1 });
  const base = hex(0x77756e);
  fill(canvas, (i) => {
    setColor(canvas, i, base, 0.82 + mottle[i] * 0.24);
    canvas.height[i] = 0.5;
    canvas.rough[i] = 0.2 + mottle[i] * 0.16;
  });
  const chips: Rgb[] = [hex(0x98948a), hex(0x4c4c49), hex(0x857459), hex(0x5e6c62), hex(0xa5a093), hex(0x6a5a4c)];
  const count = Math.floor(size * size * 0.0075);
  for (let c = 0; c < count; c++) {
    const color = chips[Math.floor(rng() * chips.length)];
    const radius = 0.7 + rng() * rng() * (size * 0.0085);
    stampDisc(canvas, rng() * size, rng() * size, radius, (i) => {
      setColor(canvas, i, color, 0.86 + mottle[i] * 0.2);
      canvas.rough[i] = 0.15;
    });
  }
  // Brass divider strips mark a grid, as in old poured terrazzo floors.
  fill(canvas, (i, x, y) => {
    if (x < 3 || y < 3) {
      setColor(canvas, i, hex(0x8a6f3c));
      canvas.height[i] = 0.62;
      canvas.rough[i] = 0.38;
    }
  });
  return canvas;
}

function lino(size: number, seed: number): Canvas {
  const canvas = createCanvas(size);
  const mottle = fbm(size, { period: 8, octaves: 5, seed });
  const scratches = fbm(size, { periodX: 2, periodY: 90, octaves: 2, seed: seed + 1 });
  const tiles = 2;
  const colorA = hex(0x5b665e);
  const colorB = hex(0x4c5650);
  fill(canvas, (i, x, y) => {
    const tx = Math.floor((x / size) * tiles);
    const ty = Math.floor((y / size) * tiles);
    const edgeX = Math.min((x / size) * tiles - tx, tx + 1 - (x / size) * tiles);
    const edgeY = Math.min((y / size) * tiles - ty, ty + 1 - (y / size) * tiles);
    const seam = smoothstep(0.012, 0, Math.min(edgeX, edgeY));
    const tone = (tx + ty) % 2 === 0 ? colorA : colorB;
    const flecks = smoothstep(0.7, 0.9, mottle[i]);
    setColor(canvas, i, mixColor(tone, hex(0x8a948c), flecks * 0.35), (0.86 + mottle[i] * 0.2) * (1 - seam * 0.55));
    const scratch = smoothstep(0.85, 0.95, scratches[i]);
    canvas.height[i] = 0.5 - seam * 0.5;
    canvas.rough[i] = 0.32 + mottle[i] * 0.16 + scratch * 0.24;
  });
  return canvas;
}

function carpet(size: number, base: Rgb, seed: number): Canvas {
  const canvas = createCanvas(size);
  const fibres = fbm(size, { period: 128, octaves: 2, seed });
  const wear = fbm(size, { period: 2, octaves: 5, seed: seed + 1 });
  fill(canvas, (i) => {
    setColor(canvas, i, base, (0.62 + fibres[i] * 0.6) * (0.74 + wear[i] * 0.42));
    canvas.height[i] = fibres[i];
    canvas.rough[i] = 0.92 + fibres[i] * 0.08;
  });
  return canvas;
}

function rubberStuds(size: number, seed: number): Canvas {
  const canvas = createCanvas(size);
  const noise = fbm(size, { period: 8, octaves: 4, seed });
  const cells = 12;
  fill(canvas, (i, x, y) => {
    const u = ((x / size) * cells) % 1;
    const v = ((y / size) * cells) % 1;
    const d = Math.hypot(u - 0.5, v - 0.5);
    const stud = smoothstep(0.32, 0.24, d);
    setColor(canvas, i, hex(0x24262a), (0.82 + noise[i] * 0.26) * (1 + stud * 0.18));
    canvas.height[i] = 0.3 + stud * 0.7;
    canvas.rough[i] = 0.72 - stud * 0.14 + noise[i] * 0.12;
  });
  return canvas;
}

function ceilingTile(size: number, seed: number): Canvas {
  const canvas = createCanvas(size);
  const stains = fbm(size, { period: 2, octaves: 6, persistence: 0.6, seed });
  const pits = fbm(size, { period: 128, octaves: 1, seed: seed + 1 });
  const tiles = 2;
  const base = hex(0x9c9a8c);
  fill(canvas, (i, x, y) => {
    const u = (x / size) * tiles;
    const v = (y / size) * tiles;
    const edge = Math.min(u - Math.floor(u), Math.ceil(u) - u, v - Math.floor(v), Math.ceil(v) - v);
    const grid = smoothstep(0.024, 0.014, edge);
    const stain = smoothstep(0.66, 0.82, stains[i]);
    const hole = smoothstep(0.62, 0.72, pits[i]);
    const tone = grid > 0.5 ? hex(0x3c3c38) : mixColor(base, hex(0x6d5a3c), stain * 0.7);
    setColor(canvas, i, tone, (0.86 + stains[i] * 0.18) * (1 - hole * 0.28));
    canvas.height[i] = 0.6 - grid * 0.6 - hole * 0.14;
    canvas.rough[i] = 0.94;
  });
  return canvas;
}

function snow(size: number, seed: number): Canvas {
  const canvas = createCanvas(size);
  const drifts = fbm(size, { period: 3, octaves: 6, seed });
  const sparkle = fbm(size, { period: 128, octaves: 1, seed: seed + 1 });
  fill(canvas, (i) => {
    const tone = mixColor(hex(0xb4c6d6), hex(0xecf2f6), drifts[i]);
    setColor(canvas, i, tone);
    canvas.height[i] = drifts[i];
    canvas.rough[i] = 0.92 - smoothstep(0.86, 0.97, sparkle[i]) * 0.5;
  });
  return canvas;
}

// Wood

function wood(size: number, dark: Rgb, light: Rgb, seed: number, panels = 0): Canvas {
  const canvas = createCanvas(size);
  const grain = fbm(size, { periodX: 2, periodY: 28, octaves: 5, persistence: 0.55, seed });
  const fine = fbm(size, { periodX: 8, periodY: 180, octaves: 2, seed: seed + 1 });
  fill(canvas, (i, x) => {
    const wave = Math.sin(grain[i] * 26) * 0.5 + 0.5;
    const tone = mixColor(dark, light, wave * 0.7 + grain[i] * 0.3);
    let seam = 0;
    if (panels > 0) {
      const u = ((x / size) * panels) % 1;
      seam = smoothstep(0.03, 0, Math.min(u, 1 - u));
    }
    setColor(canvas, i, tone, (0.86 + fine[i] * 0.22) * (1 - seam * 0.72));
    canvas.height[i] = 0.5 + fine[i] * 0.16 - seam * 0.6;
    canvas.rough[i] = 0.46 + wave * 0.16 + seam * 0.3;
  });
  return canvas;
}

// Metals

function paintedMetal(size: number, base: Rgb, seed: number, wear = 0.5): Canvas {
  const canvas = createCanvas(size);
  const mottle = fbm(size, { period: 3, octaves: 5, seed });
  const scuff = fbm(size, { periodX: 6, periodY: 64, octaves: 3, seed: seed + 1 });
  const chips = fbm(size, { period: 12, octaves: 5, persistence: 0.65, seed: seed + 2 });
  const threshold = lerp(0.9, 0.72, wear);
  const steel = hex(0x56534e);
  const rust = hex(0x5a3218);
  fill(canvas, (i) => {
    const chip = smoothstep(threshold, threshold + 0.02, chips[i]);
    const rusty = chip * mottle[i];
    const tone = mixColor(mixColor(base, steel, chip), rust, rusty * 0.8);
    setColor(canvas, i, tone, 0.84 + mottle[i] * 0.2 + scuff[i] * 0.06);
    canvas.height[i] = 0.5 - chip * 0.25 + scuff[i] * 0.05;
    canvas.rough[i] = lerp(0.42 + scuff[i] * 0.24, 0.72, chip);
  });
  return canvas;
}

function brushedMetal(size: number, base: Rgb, seed: number): Canvas {
  const canvas = createCanvas(size);
  const streaks = fbm(size, { periodX: 2, periodY: 160, octaves: 3, seed });
  const smudge = fbm(size, { period: 3, octaves: 4, seed: seed + 1 });
  fill(canvas, (i) => {
    setColor(canvas, i, base, 0.82 + streaks[i] * 0.3);
    canvas.height[i] = streaks[i] * 0.4;
    canvas.rough[i] = 0.26 + smudge[i] * 0.3 + streaks[i] * 0.08;
  });
  return canvas;
}

function rust(size: number, seed: number): Canvas {
  const canvas = createCanvas(size);
  const big = fbm(size, { period: 4, octaves: 7, persistence: 0.62, seed });
  fill(canvas, (i) => {
    const tone = mixColor(hex(0x35200f), hex(0x8a4a20), big[i]);
    setColor(canvas, i, tone);
    canvas.height[i] = big[i];
    canvas.rough[i] = 0.82 + big[i] * 0.16;
  });
  return canvas;
}

function grating(size: number, seed: number): Canvas {
  const canvas = createCanvas(size);
  const noise = fbm(size, { period: 8, octaves: 3, seed });
  const cells = 10;
  fill(canvas, (i, x, y) => {
    const u = ((x / size) * cells) % 1;
    const v = ((y / size) * cells) % 1;
    const bar = Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v));
    const metal = smoothstep(0.1, 0.16, bar);
    setColor(canvas, i, mixColor(hex(0x5a5c5e), hex(0x070708), metal), 0.8 + noise[i] * 0.3);
    canvas.height[i] = 1 - metal;
    canvas.rough[i] = 0.5 + metal * 0.4;
  });
  return canvas;
}

function hazard(size: number, seed: number): Canvas {
  const canvas = createCanvas(size);
  const wear = fbm(size, { period: 6, octaves: 5, seed });
  const yellow = hex(0xb8912a);
  const black = hex(0x171614);
  fill(canvas, (i, x, y) => {
    const stripe = ((x + y) / size) * 4;
    const inYellow = stripe - Math.floor(stripe) < 0.5;
    const worn = smoothstep(0.68, 0.84, wear[i]);
    setColor(canvas, i, mixColor(inYellow ? yellow : black, hex(0x4a4845), worn), 0.82 + wear[i] * 0.22);
    canvas.height[i] = 0.5 - worn * 0.2;
    canvas.rough[i] = 0.5 + worn * 0.4;
  });
  return canvas;
}

// Soft goods

function foam(size: number, seed: number): Canvas {
  const canvas = createCanvas(size);
  const cells = fbm(size, { period: 96, octaves: 2, seed });
  fill(canvas, (i) => {
    setColor(canvas, i, hex(0x2c2d2f), 0.7 + cells[i] * 0.5);
    canvas.height[i] = cells[i];
    canvas.rough[i] = 1;
  });
  return canvas;
}

function fabric(size: number, base: Rgb, seed: number): Canvas {
  const canvas = createCanvas(size);
  const threads = 64;
  const noise = fbm(size, { period: 4, octaves: 4, seed });
  fill(canvas, (i, x, y) => {
    const weaveX = Math.sin((x / size) * threads * Math.PI * 2);
    const weaveY = Math.sin((y / size) * threads * Math.PI * 2);
    const weave = (weaveX * weaveY + 1) / 2;
    setColor(canvas, i, base, (0.78 + weave * 0.28) * (0.8 + noise[i] * 0.36));
    canvas.height[i] = weave;
    canvas.rough[i] = 0.86 + weave * 0.1;
  });
  return canvas;
}

function grain(size: number, base: Rgb, seed: number, roughBase = 0.5, amount = 0.2): Canvas {
  const canvas = createCanvas(size);
  const fine = fbm(size, { period: 32, octaves: 4, seed });
  const big = fbm(size, { period: 3, octaves: 4, seed: seed + 1 });
  fill(canvas, (i) => {
    setColor(canvas, i, base, 1 - amount / 2 + (fine[i] * 0.5 + big[i] * 0.5) * amount);
    canvas.height[i] = fine[i];
    canvas.rough[i] = roughBase + big[i] * 0.2;
  });
  return canvas;
}

export type TextureKey =
  | 'concreteBoard'
  | 'concreteSmooth'
  | 'concreteDark'
  | 'plasterPale'
  | 'paintSeafoam'
  | 'paintOchre'
  | 'paintGrey'
  | 'terrazzo'
  | 'lino'
  | 'carpet'
  | 'rubberFloor'
  | 'grating'
  | 'ceilingTile'
  | 'snow'
  | 'rock'
  | 'wood'
  | 'woodDark'
  | 'metalPainted'
  | 'metalGreen'
  | 'metalDark'
  | 'metalBrushed'
  | 'rust'
  | 'brass'
  | 'steelBlue'
  | 'plastic'
  | 'plasticBeige'
  | 'rubber'
  | 'foam'
  | 'fabric'
  | 'fabricGreen'
  | 'fabricOrange'
  | 'fabricDark'
  | 'leather'
  | 'paper'
  | 'cardboard'
  | 'hazard'
  | 'redPaint'
  | 'plant';

interface Recipe {
  normal: number;
  paint: (size: number) => Canvas;
}

/**
 * Surfaces that fill the screen get full resolution, and small props get far less. Memory
 * grows with the square of the size, so this one choice saves hundreds of megabytes.
 */
const SIZE_DIVISOR: Partial<Record<TextureKey, number>> = {
  concreteDark: 2,
  paintOchre: 2,
  paintGrey: 2,
  carpet: 2,
  rubberFloor: 2,
  grating: 2,
  ceilingTile: 2,
  wood: 2,
  woodDark: 2,
  metalPainted: 2,
  metalGreen: 2,
  metalDark: 2,
  metalBrushed: 2,
  steelBlue: 2,
  hazard: 2,
  fabricOrange: 2,
  fabricDark: 2,
  foam: 2,
  rust: 4,
  brass: 4,
  plastic: 4,
  plasticBeige: 4,
  rubber: 4,
  fabric: 4,
  fabricGreen: 4,
  leather: 4,
  paper: 4,
  cardboard: 4,
  redPaint: 4,
  plant: 4,
};

const RECIPES: Record<TextureKey, Recipe> = {
  concreteBoard: { normal: 3.2, paint: (s) => concreteBoard(s, hex(0x77797a), 11) },
  concreteSmooth: { normal: 2, paint: (s) => concreteSmooth(s, hex(0x6c6e6c), 21) },
  concreteDark: { normal: 2, paint: (s) => concreteSmooth(s, hex(0x37393a), 31) },
  plasterPale: { normal: 1.2, paint: (s) => paint(s, hex(0xa9a899), hex(0x65635a), 41, 0.45) },
  paintSeafoam: { normal: 1.2, paint: (s) => paint(s, hex(0x547a70), hex(0x5a5a50), 51, 0.55) },
  paintOchre: { normal: 1.2, paint: (s) => paint(s, hex(0x8a7650), hex(0x4f4532), 61, 0.4) },
  paintGrey: { normal: 1.2, paint: (s) => paint(s, hex(0x63686a), hex(0x3a3a38), 71, 0.5) },
  terrazzo: { normal: 0.7, paint: (s) => terrazzo(s, 81) },
  lino: { normal: 1, paint: (s) => lino(s, 91) },
  carpet: { normal: 2.4, paint: (s) => carpet(s, hex(0x3f3a2c), 101) },
  rubberFloor: { normal: 2.6, paint: (s) => rubberStuds(s, 111) },
  grating: { normal: 3.2, paint: (s) => grating(s, 121) },
  ceilingTile: { normal: 1.4, paint: (s) => ceilingTile(s, 131) },
  snow: { normal: 2.6, paint: (s) => snow(s, 141) },
  rock: { normal: 5.2, paint: (s) => rock(s, 151) },
  wood: { normal: 1.2, paint: (s) => wood(s, hex(0x4a2f18), hex(0x8a5e34), 161) },
  woodDark: { normal: 1.4, paint: (s) => wood(s, hex(0x20140c), hex(0x4a2e1a), 171, 3) },
  metalPainted: { normal: 1, paint: (s) => paintedMetal(s, hex(0x565b58), 181, 0.45) },
  metalGreen: { normal: 1, paint: (s) => paintedMetal(s, hex(0x37524a), 191, 0.55) },
  metalDark: { normal: 1, paint: (s) => paintedMetal(s, hex(0x1e2022), 201, 0.35) },
  metalBrushed: { normal: 0.7, paint: (s) => brushedMetal(s, hex(0x9a9c9c), 211) },
  rust: { normal: 3, paint: (s) => rust(s, 221) },
  brass: { normal: 0.6, paint: (s) => brushedMetal(s, hex(0xb08a44), 231) },
  steelBlue: { normal: 1, paint: (s) => paintedMetal(s, hex(0x2d4150), 241, 0.5) },
  plastic: { normal: 0.4, paint: (s) => grain(s, hex(0x262728), 251, 0.42) },
  plasticBeige: { normal: 0.4, paint: (s) => grain(s, hex(0x9c9580), 261, 0.46) },
  rubber: { normal: 0.6, paint: (s) => grain(s, hex(0x141516), 271, 0.74) },
  foam: { normal: 1.6, paint: (s) => foam(s, 281) },
  fabric: { normal: 1.2, paint: (s) => fabric(s, hex(0x48463f), 291) },
  fabricGreen: { normal: 1.2, paint: (s) => fabric(s, hex(0x3b4b3e), 301) },
  fabricOrange: { normal: 1.6, paint: (s) => fabric(s, hex(0xb4501c), 311) },
  fabricDark: { normal: 1.6, paint: (s) => fabric(s, hex(0x23272d), 321) },
  leather: { normal: 1.6, paint: (s) => grain(s, hex(0x2a1c14), 331, 0.5, 0.3) },
  paper: { normal: 0.3, paint: (s) => grain(s, hex(0xc4bda6), 341, 0.86, 0.14) },
  cardboard: { normal: 0.8, paint: (s) => grain(s, hex(0x82694a), 351, 0.86, 0.3) },
  hazard: { normal: 0.6, paint: (s) => hazard(s, 361) },
  redPaint: { normal: 0.8, paint: (s) => paintedMetal(s, hex(0x7c1e16), 371, 0.5) },
  plant: { normal: 1, paint: (s) => grain(s, hex(0x4a3a20), 381, 0.8, 0.5) },
};

/** Creates a texture set by key. Costly, so MaterialLibrary only ever calls this once per key. */
export function createTextureSet(key: TextureKey, size: number): TextureSet {
  const recipe = RECIPES[key];
  const scaled = Math.max(64, Math.round(size / (SIZE_DIVISOR[key] ?? 1)));
  return toTextureSet(recipe.paint(scaled), recipe.normal);
}

export const ALL_TEXTURE_KEYS = Object.keys(RECIPES) as TextureKey[];
