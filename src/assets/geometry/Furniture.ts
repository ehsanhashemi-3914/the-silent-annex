// Furniture and clutter. Each prop faces +z with its origin on the floor (or on the
// surface it sits on), so a level file only has to say where it goes.

import * as THREE from 'three';
import { createRng } from '../procedural/Noise';
import type { MaterialId } from '../../world/LevelDefinition';
import { glow, type PropFn } from './Architecture';

const num = (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback);

export const receptionDesk: PropFn = (b) => {
  // A wide central run with two angled wings, so the hub has a strong landmark silhouette.
  const height = 1.05;
  b.box(4.6, height, 0.5, 0, height / 2, 0.45, 'woodDark');
  b.box(4.9, 0.08, 0.92, 0, height + 0.04, 0.3, 'concreteSmooth');
  b.box(4.6, 0.72, 0.5, 0, 0.36, 0.22, 'woodDark');
  for (const side of [-1, 1]) {
    const x = side * 3.28;
    const angle = side * 0.62;
    b.box(2, height, 0.5, x, height / 2, -0.15, 'woodDark', { ry: angle });
    b.box(2.2, 0.08, 0.9, x - side * 0.02, height + 0.04, -0.28, 'concreteSmooth', { ry: angle });
    b.solid(2.05, height, 0.8, x, height / 2, -0.2, angle);
  }
  b.box(0.9, 0.3, 0.02, 0, 0.72, 0.71, 'brass');
  // Lower work surface on the staff side.
  b.box(4.4, 0.04, 0.5, 0, 0.74, -0.22, 'wood');
  b.solid(4.9, height + 0.08, 0.92, 0, (height + 0.08) / 2, 0.3);
};

export const bench: PropFn = (b) => {
  const width = 2.2;
  for (let i = 0; i < 4; i++) {
    b.box(width, 0.03, 0.09, 0, 0.45, -0.16 + i * 0.11, 'wood');
  }
  for (let i = 0; i < 3; i++) {
    b.box(width, 0.09, 0.03, 0, 0.62 + i * 0.13, -0.24, 'wood', { rx: -0.1 });
  }
  for (const x of [-width / 2 + 0.2, width / 2 - 0.2]) {
    b.box(0.05, 0.45, 0.05, x, 0.225, 0.14, 'metalDark');
    b.box(0.05, 0.92, 0.05, x, 0.46, -0.22, 'metalDark', { rx: -0.05 });
    b.box(0.05, 0.03, 0.42, x, 0.42, -0.04, 'metalDark');
  }
  b.solid(width, 0.8, 0.5, 0, 0.4, -0.05);
};

export const chair: PropFn = (b) => {
  b.box(0.44, 0.05, 0.42, 0, 0.46, 0, 'fabricGreen');
  b.box(0.42, 0.42, 0.04, 0, 0.72, -0.22, 'fabricGreen', { rx: -0.08 });
  for (const [x, z] of [
    [-0.19, 0.18],
    [0.19, 0.18],
    [-0.19, -0.18],
    [0.19, -0.18],
  ]) {
    b.cylinder(0.012, 0.012, 0.45, x, 0.225, z, 'metalBrushed', { segments: 6 });
  }
  b.cylinder(0.01, 0.01, 0.5, -0.19, 0.72, -0.22, 'metalBrushed', { segments: 6 });
  b.cylinder(0.01, 0.01, 0.5, 0.19, 0.72, -0.22, 'metalBrushed', { segments: 6 });
  b.solid(0.46, 0.9, 0.46, 0, 0.45, -0.02);
};

export const officeChair: PropFn = (b) => {
  b.box(0.5, 0.09, 0.48, 0, 0.5, 0, 'leather');
  b.box(0.48, 0.62, 0.07, 0, 0.88, -0.25, 'leather', { rx: -0.1 });
  b.cylinder(0.025, 0.03, 0.42, 0, 0.26, 0, 'metalBrushed', { segments: 8 });
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    b.box(0.28, 0.03, 0.05, Math.cos(angle) * 0.14, 0.08, Math.sin(angle) * 0.14, 'plastic', { ry: -angle });
    b.sphere(0.025, Math.cos(angle) * 0.27, 0.03, Math.sin(angle) * 0.27, 'rubber', { segments: 6 });
  }
  b.solid(0.54, 1, 0.54, 0, 0.5, 0);
};

export const lowTable: PropFn = (b) => {
  b.box(1.5, 0.04, 0.72, 0, 0.42, 0, 'wood');
  for (const [x, z] of [
    [-0.66, 0.28],
    [0.66, 0.28],
    [-0.66, -0.28],
    [0.66, -0.28],
  ]) {
    b.cylinder(0.018, 0.012, 0.4, x, 0.2, z, 'metalDark', { segments: 6 });
  }
  b.solid(1.5, 0.46, 0.72, 0, 0.23, 0);
};

function hungCoat(b: Parameters<PropFn>[0], x: number, z: number, angle: number, material: MaterialId, length = 1): void {
  const ox = Math.sin(angle) * 0.13;
  const oz = Math.cos(angle) * 0.13;
  b.cylinder(0.14, 0.2, length, x + ox, 1.62 - length / 2, z + oz, material, { segments: 8 });
  b.sphere(0.13, x + ox, 1.62, z + oz, material, { scaleY: 0.45, segments: 8 });
  b.box(0.05, length * 0.7, 0.09, x + ox + 0.16, 1.5 - length * 0.35, z + oz, material);
  b.box(0.05, length * 0.7, 0.09, x + ox - 0.16, 1.5 - length * 0.35, z + oz, material);
}

export const coatRack: PropFn = (b, args) => {
  b.cylinder(0.018, 0.022, 1.8, 0, 0.9, 0, 'woodDark', { segments: 8 });
  b.cylinder(0.18, 0.22, 0.03, 0, 0.02, 0, 'metalDark', { segments: 10 });
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2;
    b.box(0.2, 0.02, 0.02, Math.sin(angle) * 0.09, 1.7, Math.cos(angle) * 0.09, 'brass', { ry: angle + Math.PI / 2 });
  }
  if (args.labCoat) {
    hungCoat(b, 0, 0, 0.5, 'plasterPale', 1.15);
  } else {
    const coats = num(args.coats, 1);
    hungCoat(b, 0, 0, 0.3, 'fabricGreen');
    if (coats > 1) hungCoat(b, 0, 0, 2.6, 'fabric');
  }
  b.solid(0.4, 1.8, 0.4, 0, 0.9, 0);
};

export const labCoat: PropFn = (b) => {
  hungCoat(b, 0, 0, 0, 'plasterPale', 1.15);
};

export const plant: PropFn = (b) => {
  b.cylinder(0.2, 0.15, 0.36, 0, 0.18, 0, 'concreteDark', { segments: 12 });
  b.cylinder(0.18, 0.18, 0.02, 0, 0.34, 0, 'rubber', { segments: 12 });
  const rng = createRng(31);
  for (let i = 0; i < 10; i++) {
    const angle = rng() * Math.PI * 2;
    const lean = 0.1 + rng() * 0.5;
    const length = 0.5 + rng() * 0.9;
    const x = Math.sin(angle) * Math.sin(lean) * length * 0.5;
    const z = Math.cos(angle) * Math.sin(lean) * length * 0.5;
    b.cylinder(0.004, 0.012, length, x, 0.34 + Math.cos(lean) * length * 0.5, z, 'plant', {
      rx: Math.cos(angle) * lean,
      rz: -Math.sin(angle) * lean,
      segments: 4,
    });
  }
  b.solid(0.4, 0.5, 0.4, 0, 0.25, 0);
};

export const vending: PropFn = (b) => {
  b.box(1, 1.95, 0.72, 0, 0.975, -0.04, 'metalPainted');
  b.box(0.92, 1.3, 0.02, -0.04, 1.2, 0.33, 'glassDark');
  b.box(0.2, 0.6, 0.03, 0.34, 0.96, 0.33, 'metalDark');
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      b.box(0.1, 0.14, 0.1, -0.33 + x * 0.17, 0.72 + y * 0.28, 0.2, x % 2 ? 'cardboard' : 'redPaint');
    }
  }
  b.box(0.5, 0.18, 0.04, -0.1, 0.32, 0.33, 'plastic');
  b.box(0.8, 0.2, 0.02, 0, 1.78, 0.33, 'plasticBeige');
  b.solid(1, 1.95, 0.72, 0, 0.975, -0.04);
};

export const desk: PropFn = (b, args) => {
  const width = num(args.w, 1.8);
  b.box(width, 0.045, 0.82, 0, 0.76, 0, 'wood');
  for (const side of [-1, 1]) {
    const x = (side * (width - 0.46)) / 2;
    b.box(0.42, 0.72, 0.74, x, 0.37, 0, 'wood');
    for (let i = 0; i < 3; i++) {
      b.box(0.37, 0.2, 0.01, x, 0.6 - i * 0.23, 0.375, 'woodDark');
      b.box(0.09, 0.015, 0.02, x, 0.6 - i * 0.23, 0.39, 'brass');
    }
  }
  b.box(width - 0.9, 0.5, 0.02, 0, 0.45, -0.35, 'wood');
  b.solid(width, 0.8, 0.82, 0, 0.4, 0);
};

export const bookshelf: PropFn = (b) => {
  const rng = createRng(61);
  const width = 1.9;
  const depth = 0.34;
  const height = 2.4;
  b.box(width, height, 0.02, 0, height / 2, -depth / 2, 'woodDark');
  for (const x of [-width / 2, width / 2]) b.box(0.04, height, depth, x, height / 2, 0, 'woodDark');
  const covers: MaterialId[] = ['leather', 'fabricGreen', 'fabric', 'plasticBeige', 'redPaint', 'steelBlue', 'paper'];
  for (let shelf = 0; shelf < 6; shelf++) {
    const y = 0.03 + shelf * 0.46;
    b.box(width, 0.03, depth, 0, y, 0, 'woodDark');
    let x = -width / 2 + 0.05;
    while (x < width / 2 - 0.1) {
      const thick = 0.03 + rng() * 0.05;
      if (rng() > 0.1) {
        const tall = 0.24 + rng() * 0.14;
        const material = covers[Math.floor(rng() * covers.length)];
        b.box(thick, tall, 0.2 + rng() * 0.05, x + thick / 2, y + 0.015 + tall / 2, 0.02, material, { rz: rng() > 0.92 ? 0.14 : 0 });
      }
      x += thick + 0.003;
    }
  }
  b.box(width, 0.04, depth, 0, height, 0, 'woodDark');
  b.solid(width, height, depth, 0, height / 2, 0);
};

function cabinetAt(b: Parameters<PropFn>[0], x: number, z: number, rng: () => number): void {
  const w = 0.46;
  b.box(w, 1.35, 0.62, x, 0.675, z, 'metalGreen');
  for (let i = 0; i < 4; i++) {
    const y = 0.2 + i * 0.32;
    const pulled = rng() > 0.86 ? 0.06 + rng() * 0.1 : 0;
    b.box(w - 0.03, 0.29, 0.02, x, y, z + 0.315 + pulled, 'metalGreen');
    b.box(0.13, 0.02, 0.025, x, y + 0.04, z + 0.335 + pulled, 'metalBrushed');
    b.box(0.09, 0.04, 0.005, x, y + 0.09, z + 0.326 + pulled, 'paper');
  }
}

export const filingCabinet: PropFn = (b) => {
  cabinetAt(b, 0, 0, createRng(11));
  b.solid(0.46, 1.35, 0.68, 0, 0.675, 0);
};

/** Two back-to-back runs of cabinets, forming the aisles of the records room. */
export const filingRow: PropFn = (b, args) => {
  const count = num(args.count, 6);
  const rng = createRng(count * 13 + 5);
  const width = count * 0.48;
  for (let i = 0; i < count; i++) {
    const x = -width / 2 + (i + 0.5) * 0.48;
    cabinetAt(b, x, 0.31, rng);
    // The back row faces the other way, so we offset it behind the front one.
    b.box(0.46, 1.35, 0.62, x, 0.675, -0.31, 'metalGreen');
    for (let d = 0; d < 4; d++) {
      b.box(0.43, 0.29, 0.02, x, 0.2 + d * 0.32, -0.625, 'metalGreen');
      b.box(0.13, 0.02, 0.025, x, 0.24 + d * 0.32, -0.645, 'metalBrushed');
    }
  }
  b.box(width + 0.04, 0.03, 1.28, 0, 1.365, 0, 'metalDark');
  b.solid(width, 1.4, 1.34, 0, 0.7, 0);
};

export const rug: PropFn = (b, args) => {
  const w = num(args.w, 3);
  const d = num(args.d, 2);
  const color = num(args.color, 0x3a2a20);
  const material = b.materials.customMaterial(`rug:${color}`, () =>
    new THREE.MeshStandardMaterial({
      color,
      roughness: 1,
      map: b.materials.get('carpet').map,
      normalMap: b.materials.get('carpet').normalMap,
    }),
  );
  b.mesh(new THREE.BoxGeometry(w, 0.012, d), material, 0, 0.006, 0);
};

export const labBench: PropFn = (b, args) => {
  const length = num(args.length, 5);
  const rng = createRng(length * 31);
  b.box(length, 0.05, 0.92, 0, 0.9, 0, 'metalDark');
  b.box(length - 0.1, 0.84, 0.82, 0, 0.44, 0, 'metalGreen');
  const units = Math.floor(length / 0.8);
  for (let i = 0; i < units; i++) {
    const x = -length / 2 + (i + 0.5) * (length / units);
    for (const side of [1, -1]) {
      b.box(length / units - 0.03, 0.72, 0.01, x, 0.46, side * 0.415, 'metalGreen');
      b.box(0.12, 0.018, 0.018, x, 0.74, side * 0.425, 'metalBrushed');
    }
  }
  b.box(length, 0.08, 0.84, 0, 0.04, 0, 'rubber');
  for (let i = 0; i < 4; i++) {
    const x = (rng() - 0.5) * (length - 1);
    b.cylinder(0.035, 0.05, 0.12, x, 0.985, (rng() - 0.5) * 0.5, 'glassFrosted', { segments: 8 });
  }
  b.solid(length, 0.95, 0.92, 0, 0.47, 0);
};

export const stool: PropFn = (b) => {
  b.cylinder(0.17, 0.17, 0.04, 0, 0.68, 0, 'wood', { segments: 12 });
  for (let i = 0; i < 3; i++) {
    const angle = (i / 3) * Math.PI * 2 + 0.4;
    b.cylinder(0.012, 0.012, 0.68, Math.cos(angle) * 0.14, 0.33, Math.sin(angle) * 0.14, 'metalDark', {
      rx: Math.sin(angle) * 0.14,
      rz: -Math.cos(angle) * 0.14,
      segments: 5,
    });
  }
  b.torus(0.13, 0.008, 0, 0.26, 0, 'metalDark', { rx: Math.PI / 2 });
  b.solid(0.34, 0.7, 0.34, 0, 0.35, 0);
};

export const whiteboard: PropFn = (b) => {
  const material = b.materials.customMaterial('whiteboard', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.fillStyle = '#a8a89e';
    ctx.fillRect(0, 0, 1024, 512);
    ctx.fillStyle = 'rgba(40,40,40,0.14)';
    for (let i = 0; i < 14; i++) ctx.fillRect(Math.random() * 900, Math.random() * 460, 180, 18);
    ctx.fillStyle = '#1c2640';
    ctx.font = 'italic 38px "Courier Prime", monospace';
    const lines = ['R(t) = ∫ s(τ) e^(-k|t-τ|) dτ', 'k → 0  ??', 'no decay. no ORDER.', 'gain vs. listeners: LINEAR'];
    lines.forEach((line, i) => ctx.fillText(line, 50, 76 + i * 72));
    ctx.fillStyle = '#7a1c14';
    ctx.font = 'italic 600 42px "Courier Prime", monospace';
    ctx.fillText('WHAT IS THE LOUDEST', 340, 400);
    ctx.fillText('THING IN THE MOUNTAIN?', 340, 452);
    ctx.fillRect(340, 464, 590, 5);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return new THREE.MeshStandardMaterial({
      map: b.materials.track(texture),
      roughness: 0.34,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
  });
  b.box(3.1, 1.34, 0.04, 0, 0, 0.02, 'metalBrushed');
  b.plane(3, 1.24, 0, 0, 0.042, material);
  b.box(2, 0.03, 0.06, 0, -0.68, 0.05, 'metalBrushed');
};

export const shelf: PropFn = (b, args) => {
  const length = num(args.length, 3);
  const rng = createRng(length * 41 + 3);
  const depth = 0.55;
  const uprights = Math.ceil(length / 1.2) + 1;
  for (let i = 0; i < uprights; i++) {
    const x = -length / 2 + (i / (uprights - 1)) * length;
    for (const z of [-depth / 2, depth / 2]) b.box(0.05, 2.5, 0.05, x, 1.25, z, 'steelBlue');
  }
  const contents: MaterialId[] = ['cardboard', 'cardboard', 'plasticBeige', 'metalPainted'];
  for (let level = 0; level < 4; level++) {
    const y = 0.14 + level * 0.76;
    b.box(length, 0.03, depth, 0, y, 0, 'metalPainted');
    let x = -length / 2 + 0.08;
    while (x < length / 2 - 0.2) {
      const w = 0.22 + rng() * 0.46;
      if (x + w > length / 2) break;
      if (rng() > 0.25) {
        const h = 0.14 + rng() * 0.42;
        const d = 0.25 + rng() * 0.22;
        b.box(w - 0.02, h, d, x + w / 2, y + 0.015 + h / 2, (rng() - 0.5) * 0.08, contents[Math.floor(rng() * contents.length)], {
          ry: (rng() - 0.5) * 0.14,
        });
      }
      x += w + 0.03;
    }
  }
  b.solid(length, 2.5, depth + 0.05, 0, 1.25, 0);
};

export const locker: PropFn = (b, args) => {
  const w = 0.66;
  const h = 1.9;
  b.box(w, h, 0.46, 0, h / 2, 0, 'metalGreen');
  for (let i = 0; i < 3; i++) b.box(0.3, 0.015, 0.01, 0, h - 0.18 - i * 0.04, 0.234, 'metalDark');
  b.box(0.1, 0.08, 0.02, 0.2, 1.05, 0.24, 'metalBrushed');
  b.box(0.1, 0.05, 0.005, 0, h - 0.34, 0.233, 'paper');
  if (args.open) {
    b.box(w - 0.04, h - 0.04, 0.34, 0, h / 2, 0.08, 'metalDark');
    b.box(0.02, h - 0.06, w - 0.05, w / 2 + 0.01, h / 2, 0.55, 'metalGreen');
    b.box(w - 0.1, 0.02, 0.32, 0, 1.25, 0.1, 'metalPainted');
  } else {
    b.box(w - 0.02, h - 0.03, 0.01, 0, h / 2, 0.232, 'metalGreen');
  }
  b.solid(w, h, 0.46, 0, h / 2, 0);
};

export const crate: PropFn = (b, args) => {
  const w = num(args.w, 0.9);
  const h = num(args.h, 0.7);
  const d = num(args.d, 0.8);
  b.box(w, h, d, 0, h / 2, 0, 'cardboard');
  b.box(w + 0.01, 0.04, 0.09, 0, h - 0.01, 0, 'paper');
  b.box(w * 0.28, h * 0.22, 0.003, w * 0.14, h * 0.62, d / 2 + 0.002, 'paper');
  b.solid(w, h, d, 0, h / 2, 0);
};

export const cart: PropFn = (b) => {
  b.box(1, 0.03, 0.56, 0, 0.82, 0, 'metalBrushed');
  b.box(1, 0.03, 0.56, 0, 0.32, 0, 'metalBrushed');
  for (const [x, z] of [
    [-0.47, 0.25],
    [0.47, 0.25],
    [-0.47, -0.25],
    [0.47, -0.25],
  ]) {
    b.cylinder(0.012, 0.012, 0.86, x, 0.47, z, 'metalBrushed', { segments: 6 });
    b.cylinder(0.05, 0.05, 0.03, x, 0.05, z, 'rubber', { rx: Math.PI / 2, segments: 10 });
  }
  b.cylinder(0.012, 0.012, 0.56, -0.5, 1, 0, 'metalBrushed', { rx: Math.PI / 2, segments: 6 });
  b.box(0.46, 0.3, 0.3, 0.2, 0.48, 0, 'plasticBeige');
  b.box(0.3, 0.03, 0.3, -0.2, 0.85, 0.05, 'paper');
  b.solid(1, 1, 0.6, 0, 0.5, 0);
};

export const wallSafe: PropFn = (b) => {
  b.box(0.7, 0.7, 0.06, 0, 0, 0.03, 'metalDark');
  b.box(0.6, 0.6, 0.04, 0, 0, 0.07, 'steelBlue');
  b.cylinder(0.07, 0.07, 0.03, -0.1, 0.05, 0.1, 'metalBrushed', { rx: Math.PI / 2, segments: 16 });
  b.box(0.02, 0.05, 0.015, -0.1, 0.09, 0.115, 'plastic');
  b.cylinder(0.018, 0.018, 0.1, 0.16, -0.05, 0.13, 'metalBrushed', { rx: Math.PI / 2, segments: 6 });
  b.cylinder(0.012, 0.012, 0.14, 0.16, -0.05, 0.18, 'metalBrushed', { rz: Math.PI / 2, segments: 6 });
};

export const phone: PropFn = (b) => {
  b.box(0.22, 0.05, 0.26, 0, 0.03, 0, 'plastic');
  b.box(0.2, 0.05, 0.14, 0, 0.07, -0.04, 'plastic', { rx: 0.2 });
  b.cylinder(0.07, 0.075, 0.015, 0, 0.09, 0.05, 'metalBrushed', { rx: 0.25, segments: 14 });
  b.cylinder(0.022, 0.022, 0.24, 0, 0.13, -0.05, 'plastic', { rz: Math.PI / 2, segments: 8 });
  for (const x of [-0.11, 0.11]) b.sphere(0.035, x, 0.13, -0.05, 'plastic', { segments: 8, scaleX: 0.7 });
};

export const papers: PropFn = (b, args) => {
  const rng = createRng(Math.floor(num(args.seed, 7)));
  const scatter = Boolean(args.scatter);
  const count = scatter ? 7 : 4;
  for (let i = 0; i < count; i++) {
    const spread = scatter ? 0.9 : 0.05;
    b.box(0.21, 0.002, 0.3, (rng() - 0.5) * spread, 0.004 + i * 0.002, (rng() - 0.5) * spread, 'paper', {
      ry: (rng() - 0.5) * (scatter ? 3 : 0.5),
    });
  }
};

export const magazines: PropFn = (b) => {
  const rng = createRng(19);
  const colors: MaterialId[] = ['redPaint', 'steelBlue', 'paper', 'plasticBeige'];
  for (let i = 0; i < 5; i++) {
    b.box(0.21, 0.005, 0.28, (rng() - 0.5) * 0.5, 0.004 + i * 0.005, (rng() - 0.5) * 0.25, colors[i % colors.length], {
      ry: (rng() - 0.5) * 1.8,
    });
  }
};

export const mug: PropFn = (b) => {
  b.cylinder(0.04, 0.036, 0.09, 0, 0.045, 0, 'plasticBeige', { segments: 10 });
  b.cylinder(0.034, 0.034, 0.002, 0, 0.08, 0, 'rust', { segments: 10 });
  b.torus(0.025, 0.006, 0.05, 0.045, 0, 'plasticBeige', { ry: 0, segments: 8 });
};

export const lampDesk: PropFn = (b) => {
  b.cylinder(0.08, 0.09, 0.025, 0, 0.012, 0, 'metalDark', { segments: 12 });
  b.cylinder(0.008, 0.008, 0.34, 0, 0.18, -0.02, 'metalDark', { rx: -0.15, segments: 6 });
  b.cylinder(0.008, 0.008, 0.2, 0, 0.36, 0.03, 'metalDark', { rx: 1, segments: 6 });
  b.cylinder(0.05, 0.1, 0.13, 0, 0.36, 0.14, 'metalGreen', { rx: 0.5, segments: 12, open: true });
  const bulb = glow(b, 0xffd9a0, 5);
  b.mesh(new THREE.SphereGeometry(0.03, 8, 6), bulb, 0, 0.335, 0.16);
};
