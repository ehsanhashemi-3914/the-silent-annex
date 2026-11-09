// Research equipment and the machines at the heart of the puzzles.

import * as THREE from 'three';
import { createRng } from '../procedural/Noise';
import { screenTexture } from '../procedural/SurfaceArt';
import type { MaterialId } from '../../world/LevelDefinition';
import { glow, type PropFn } from './Architecture';
import type { PropBuilder } from './PropBuilder';

const num = (value: unknown, fallback: number): number => (typeof value === 'number' ? value : fallback);

function screen(b: PropBuilder, kind: 'terminal' | 'scope' | 'status', seed = 1): THREE.Material {
  return b.materials.customMaterial(`screen:${kind}:${seed}`, () => {
    const material = new THREE.MeshBasicMaterial({ map: b.materials.track(screenTexture(kind, seed)) });
    material.color.setScalar(1.5);
    return material;
  });
}

/** A beige 1980s terminal with a keyboard. */
export const crt: PropFn = (b, args) => {
  b.box(0.44, 0.36, 0.08, 0, 0.3, 0.1, 'plasticBeige');
  b.box(0.4, 0.32, 0.34, 0, 0.29, -0.09, 'plasticBeige');
  b.box(0.22, 0.04, 0.2, 0, 0.09, -0.02, 'plasticBeige');
  b.box(0.32, 0.03, 0.26, 0, 0.02, -0.02, 'plasticBeige');
  b.plane(0.34, 0.26, 0, 0.3, 0.142, screen(b, typeof args.kind === 'string' ? (args.kind as 'scope') : 'terminal', 2));
  b.box(0.42, 0.03, 0.16, 0, 0.018, 0.3, 'plasticBeige', { rx: 0.07 });
  for (let i = 0; i < 4; i++) b.box(0.38, 0.012, 0.025, 0, 0.038, 0.25 + i * 0.03, 'plastic');
};

/** A reel-to-reel recorder lying on a bench. Its reels turn when told to. */
export const reelDeck: PropFn = (b, args) => {
  b.box(0.62, 0.2, 0.46, 0, 0.1, 0, 'plasticBeige');
  b.box(0.58, 0.015, 0.42, 0, 0.205, 0, 'metalBrushed');
  const speed = args.spinning ? 1.3 : 0;
  for (const x of [-0.16, 0.16]) {
    const geometry = new THREE.CylinderGeometry(0.11, 0.11, 0.016, 18);
    if (speed) {
      b.spinner(geometry, 'plastic', x, 0.23, -0.05, speed, 'y');
    } else {
      b.add(geometry.translate(x, 0.23, -0.05), 'plastic');
    }
    b.cylinder(0.02, 0.02, 0.03, x, 0.24, -0.05, 'metalBrushed', { segments: 8 });
  }
  b.box(0.3, 0.004, 0.012, 0, 0.222, -0.15, 'plastic');
  for (let i = 0; i < 5; i++) b.box(0.05, 0.02, 0.05, -0.16 + i * 0.08, 0.215, 0.14, i === 2 ? 'redPaint' : 'plastic');
};

export const breakerPanel: PropFn = (b) => {
  b.box(1.5, 1.9, 0.26, 0, 1.3, 0.13, 'metalGreen');
  b.box(1.4, 1.8, 0.01, 0, 1.3, 0.265, 'metalDark');
  // Four large knife-switch handles.
  for (let i = 0; i < 4; i++) {
    const x = -0.51 + i * 0.34;
    b.box(0.22, 0.46, 0.05, x, 1.56, 0.29, 'plastic');
    b.box(0.05, 0.2, 0.09, x, 1.66, 0.34, 'redPaint', { rx: -0.8 });
    b.box(0.2, 0.06, 0.005, x, 1.84, 0.273, 'paper');
  }
  // The fuse row, with socket F3 standing empty.
  for (let i = 0; i < 4; i++) {
    const x = -0.51 + i * 0.34;
    b.box(0.2, 0.11, 0.03, x, 1.04, 0.285, 'plastic');
    if (i !== 2) b.cylinder(0.024, 0.024, 0.16, x, 1.04, 0.3, 'plasticBeige', { rz: Math.PI / 2, segments: 8 });
  }
  b.box(1.1, 0.14, 0.02, 0, 0.8, 0.275, 'metalBrushed');
  b.box(0.1, 0.32, 0.1, 0.52, 0.72, 0.3, 'plastic');
  for (let i = 0; i < 3; i++) b.cylinder(0.022, 0.022, 0.5, -0.4 + i * 0.4, 2.45, 0.1, 'metalPainted', { segments: 6 });
  b.solid(1.5, 2, 0.34, 0, 1.3, 0.13);
};

export const scopeRack: PropFn = (b) => {
  b.box(0.64, 1.9, 0.56, 0, 0.95, 0, 'metalDark');
  const rng = createRng(53);
  for (let i = 0; i < 5; i++) {
    const y = 0.34 + i * 0.33;
    b.box(0.58, 0.3, 0.02, 0, y, 0.285, 'metalPainted');
    if (i % 2 === 0) {
      b.plane(0.22, 0.17, -0.14, y, 0.298, screen(b, 'scope', i + 3));
    }
    for (let k = 0; k < 4; k++) {
      b.cylinder(0.017, 0.017, 0.02, 0.05 + k * 0.06, y + (rng() - 0.5) * 0.1, 0.3, 'metalBrushed', { rx: Math.PI / 2, segments: 8 });
    }
  }
  b.solid(0.64, 1.9, 0.56, 0, 0.95, 0);
};

export const transformer: PropFn = (b, args) => {
  const scale = args.small ? 0.68 : 1;
  const w = 1.5 * scale;
  const h = 1.8 * scale;
  const d = 0.9 * scale;
  b.box(w, h, d, 0, h / 2, 0, 'metalPainted');
  for (let i = 0; i < 8; i++) {
    b.box(0.04, h - 0.3, 0.14, -w / 2 + 0.15 + (i * (w - 0.3)) / 7, h / 2, d / 2 + 0.07, 'metalPainted');
  }
  b.box(w + 0.04, 0.06, d + 0.04, 0, h, 0, 'metalDark');
  b.box(0.4 * scale, 0.26 * scale, 0.01, 0, h * 0.85, d / 2 + 0.15, 'hazard');
  for (const x of [-0.4, 0, 0.4]) {
    b.cylinder(0.05 * scale, 0.07 * scale, 0.32 * scale, x * scale, h + 0.16 * scale, 0, 'plasticBeige', { segments: 10 });
  }
  b.solid(w, h + 0.3, d + 0.3, 0, (h + 0.3) / 2, 0.05);
};

/** A very tall run of open steel shelving, filled with archive tape cases. */
export const tapeRack: PropFn = (b, args) => {
  const length = num(args.length, 8);
  const rng = createRng(length * 71 + 9);
  const depth = 0.7;
  const height = 5.4;
  const uprights = Math.round(length / 1.4) + 1;
  for (let i = 0; i < uprights; i++) {
    const x = -length / 2 + (i / (uprights - 1)) * length;
    for (const z of [-depth / 2, depth / 2]) b.box(0.07, height, 0.07, x, height / 2, z, 'metalPainted');
  }
  const cases: MaterialId[] = ['plasticBeige', 'plastic', 'cardboard', 'steelBlue'];
  for (let level = 0; level < 8; level++) {
    const y = 0.25 + level * 0.66;
    b.box(length, 0.03, depth, 0, y, 0, 'metalPainted');
    let x = -length / 2 + 0.05;
    while (x < length / 2 - 0.1) {
      const run = 0.18 + rng() * 0.3;
      if (rng() > 0.18) {
        // Tall sleeves stand side by side, each pair facing an aisle.
        const material = cases[Math.floor(rng() * cases.length)];
        for (const side of [-1, 1]) {
          b.box(run - 0.01, 0.34 + rng() * 0.12, 0.28, x + run / 2, y + 0.2, side * 0.17, material);
        }
      }
      x += run;
    }
  }
  b.solid(length, height, depth + 0.08, 0, height / 2, 0);
};

export const micStand: PropFn = (b) => {
  b.cylinder(0.12, 0.14, 0.03, 0, 0.015, 0, 'metalDark', { segments: 14 });
  b.cylinder(0.01, 0.012, 1.35, 0, 0.69, 0, 'metalBrushed', { segments: 6 });
  b.cylinder(0.008, 0.008, 0.36, 0, 1.42, 0.13, 'metalBrushed', { rx: 1, segments: 6 });
  b.sphere(0.04, 0, 1.53, 0.28, 'foam', { scaleZ: 1.5, segments: 10 });
};

export const testChair: PropFn = (b) => {
  b.box(0.54, 0.06, 0.52, 0, 0.5, 0, 'wood');
  b.box(0.54, 0.74, 0.05, 0, 0.9, -0.25, 'wood', { rx: -0.06 });
  b.box(0.05, 0.04, 0.44, -0.27, 0.72, -0.02, 'wood');
  b.box(0.05, 0.04, 0.44, 0.27, 0.72, -0.02, 'wood');
  for (const [x, z] of [
    [-0.24, 0.22],
    [0.24, 0.22],
    [-0.24, -0.22],
    [0.24, -0.22],
  ]) {
    b.box(0.05, 0.5, 0.05, x, 0.25, z, 'wood');
    if (z > 0) b.box(0.05, 0.22, 0.05, x, 0.61, z, 'wood');
  }
  // A headset hanging on the chair's back.
  b.torus(0.09, 0.009, 0, 1.3, -0.25, 'plastic', { arc: Math.PI, rz: 0 });
  for (const x of [-0.09, 0.09]) b.cylinder(0.04, 0.04, 0.03, x, 1.3, -0.25, 'plastic', { rz: Math.PI / 2, segments: 10 });
  b.solid(0.58, 1.2, 0.56, 0, 0.6, -0.02);
};

/** A floor of open steel mesh, raised just enough to catch the torchlight. */
export const wireFloor: PropFn = (b, args) => {
  const size = args.large ? 34 : 9;
  const geometry = new THREE.PlaneGeometry(size, size).rotateX(-Math.PI / 2);
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size, uv.getY(i) * size);
  geometry.translate(0, 0.02, 0);
  b.add(geometry, 'grating');
};

export const coolantWheel: PropFn = (b) => {
  b.cylinder(0.08, 0.08, 0.3, 0, 0, 0.15, 'metalGreen', { rx: Math.PI / 2, segments: 12 });
  b.torus(0.2, 0.024, 0, 0, 0.32, 'redPaint', { segments: 22 });
  for (let i = 0; i < 3; i++) {
    b.box(0.4, 0.024, 0.024, 0, 0, 0.32, 'redPaint', { rz: (i / 3) * Math.PI });
  }
  b.cylinder(0.04, 0.04, 0.05, 0, 0, 0.33, 'metalBrushed', { rx: Math.PI / 2, segments: 10 });
};

/**
 * The security desk. Each of its monitors carries a feed index so that the renderer
 * can draw live views of the building onto them.
 */
export const securityConsole: PropFn = (b) => {
  const width = 7;
  b.box(width, 0.05, 1, 0, 0.8, 0, 'metalDark');
  b.box(width, 0.78, 0.8, 0, 0.39, -0.05, 'metalPainted');
  b.box(width, 0.15, 0.5, 0, 0.92, 0.18, 'metalPainted', { rx: 0.35 });
  const rng = createRng(83);
  for (let i = 0; i < 50; i++) {
    b.box(0.02, 0.012, 0.02, -width / 2 + 0.15 + rng() * (width - 0.3), 0.99, 0.2 + rng() * 0.1, i % 7 === 0 ? 'redPaint' : 'plastic');
  }
  let feed = 0;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      const x = -2.75 + col * 1.1;
      const y = 1.3 + row * 0.62;
      b.box(0.96, 0.6, 0.5, x, y, -0.25, 'metalDark');
      const monitor = b.plane(0.84, 0.5, x, y, 0.005, b.materials.customMaterial('screenOff', () => new THREE.MeshBasicMaterial({ color: 0x031008 })));
      monitor.userData.feedIndex = feed++;
    }
  }
  b.box(0.72, 0.26, 0.44, 2.3, 1, 0.1, 'plasticBeige');
  b.box(0.54, 0.1, 0.02, 2.3, 1.04, 0.32, 'plastic');
  b.solid(width, 1.9, 1.1, 0, 0.95, -0.15);
};

export const generatorPanel: PropFn = (b) => {
  b.box(1.9, 1.8, 0.16, 0, 1.25, 0.08, 'metalGreen');
  b.box(1.8, 1.7, 0.01, 0, 1.25, 0.165, 'metalDark');
  const lamps = glow(b, 0x8a1c10, 1.4);
  for (let i = 0; i < 5; i++) {
    const x = -0.72 + i * 0.36;
    b.cylinder(0.07, 0.07, 0.02, x, 1.7, 0.18, 'metalBrushed', { rx: Math.PI / 2, segments: 14 });
    b.box(0.03, 0.09, 0.02, x, 1.3, 0.18, 'plastic');
    b.mesh(new THREE.SphereGeometry(0.02, 8, 6), lamps, x, 1.45, 0.18);
    b.box(0.22, 0.05, 0.005, x, 1.1, 0.172, 'paper');
  }
  b.box(0.18, 0.18, 0.04, 0, 0.8, 0.19, 'brass');
};

export const postStation: PropFn = (b) => {
  b.box(0.44, 0.74, 0.14, 0, 1.2, 0.07, 'brass');
  b.cylinder(0.11, 0.11, 0.1, 0, 1.3, 0.18, 'brass', { rx: Math.PI / 2, segments: 16 });
  b.torus(0.11, 0.012, 0, 1.3, 0.24, 'metalBrushed', { segments: 18 });
  b.cylinder(0.075, 0.075, 2.8, 0, 2.7, 0.08, 'brass', { segments: 12 });
  b.cylinder(0.075, 0.075, 0.9, 0, 0.42, 0.08, 'brass', { segments: 12 });
  b.box(0.3, 0.09, 0.005, 0, 0.96, 0.143, 'paper');
  b.sphere(0.02, 0.15, 1.5, 0.15, 'plastic', { segments: 8 });
  const lamp = glow(b, 0xffb04a, 2.6);
  b.mesh(new THREE.SphereGeometry(0.018, 8, 6), lamp, -0.15, 1.5, 0.15);
  b.solid(0.44, 1.5, 0.3, 0, 1, 0.12);
};

/** A dictation machine with a stubby microphone: the game's save point. */
export const recorder: PropFn = (b) => {
  b.box(0.34, 0.09, 0.24, 0, 0.045, 0, 'metalPainted');
  for (const x of [-0.08, 0.08]) b.cylinder(0.05, 0.05, 0.01, x, 0.1, -0.03, 'plastic', { segments: 12 });
  b.box(0.3, 0.02, 0.07, 0, 0.1, 0.075, 'plastic');
  const lamp = glow(b, 0xff3a20, 4);
  b.mesh(new THREE.SphereGeometry(0.009, 6, 5), lamp, 0.14, 0.1, 0.1);
  b.cylinder(0.02, 0.016, 0.1, -0.2, 0.05, 0.05, 'plastic', { segments: 8, rz: 0.3 });
  b.sphere(0.024, -0.215, 0.11, 0.05, 'metalBrushed', { segments: 8 });
};

export const cardReader: PropFn = (b) => {
  b.box(0.14, 0.22, 0.03, 0, 0, 0.015, 'metalDark');
  b.box(0.1, 0.02, 0.012, 0, 0.03, 0.033, 'plastic');
};

export const keypad: PropFn = (b) => {
  b.box(0.16, 0.24, 0.03, 0, 0, 0.015, 'metalDark');
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 3; col++) {
      b.box(0.028, 0.028, 0.008, -0.04 + col * 0.04, 0.06 - row * 0.04, 0.033, 'metalBrushed');
    }
  }
};

/** The archive's retrieval panel: seven rotary drums and a long brass lever. */
export const dialPanel: PropFn = (b) => {
  b.box(1.1, 0.64, 0.08, 0, 0, 0.04, 'metalGreen');
  b.box(1.02, 0.28, 0.01, 0, 0.1, 0.085, 'metalDark');
  for (let i = 0; i < 7; i++) {
    b.cylinder(0.038, 0.038, 0.09, -0.42 + i * 0.14, 0.1, 0.09, 'metalBrushed', { rz: Math.PI / 2, segments: 12 });
  }
  b.box(0.6, 0.06, 0.005, -0.1, -0.12, 0.083, 'paper');
  b.box(0.05, 0.05, 0.08, 0.42, -0.14, 0.1, 'metalDark');
  b.cylinder(0.014, 0.014, 0.34, 0.42, 0.02, 0.14, 'brass', { rx: -0.2, segments: 8 });
  b.sphere(0.03, 0.42, 0.2, 0.17, 'plastic', { segments: 10 });
  const lamp = glow(b, 0xff3a20, 2.4);
  b.mesh(new THREE.SphereGeometry(0.014, 6, 5), lamp, 0.48, 0.22, 0.09);
};

/**
 * The Annex's centrepiece: tape loops falling in long curtains from the ceiling
 * to a hoop above the transmitter. Thousands of hours of the mountain's memory.
 */
export const tapeArray: PropFn = (b) => {
  const rng = createRng(1410);
  const top = 13.6;
  b.torus(3.4, 0.07, 0, top - 0.6, 0, 'metalDark', { rx: Math.PI / 2, segments: 40 });
  b.torus(1.7, 0.05, 0, 3.25, 0, 'metalBrushed', { rx: Math.PI / 2, segments: 30 });
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    b.cylinder(0.024, 0.024, top - 3.25, Math.cos(angle) * 1.7, (top + 3.25) / 2, Math.sin(angle) * 1.7, 'metalDark', { segments: 6 });
  }
  const material = b.materials.customMaterial('tapeRibbon', () =>
    new THREE.MeshStandardMaterial({ color: 0x1a120c, roughness: 0.32, metalness: 0.5, side: THREE.DoubleSide, vertexColors: true }),
  );
  const ribbons: THREE.BufferGeometry[] = [];
  for (let i = 0; i < 150; i++) {
    const angle = rng() * Math.PI * 2;
    const radiusTop = 2.5 + rng() * 1.1;
    const radiusBottom = 1.68;
    const lower = 3.25 + rng() * 0.2;
    const height = top - 0.6 - lower;
    const ribbon = new THREE.PlaneGeometry(0.034, height, 1, 12);
    const position = ribbon.attributes.position as THREE.BufferAttribute;
    const sway = rng() * 0.25;
    const phase = rng() * 6.28;
    for (let v = 0; v < position.count; v++) {
      const t = position.getY(v) / height + 0.5;
      const radius = radiusBottom + (radiusTop - radiusBottom) * t;
      const bow = Math.sin(t * Math.PI) * sway * Math.sin(phase);
      const x = position.getX(v);
      const a = angle + bow;
      position.setXYZ(v, Math.cos(a) * radius - Math.sin(a) * x, lower + t * height, Math.sin(a) * radius + Math.cos(a) * x);
    }
    ribbon.computeVertexNormals();
    ribbon.setAttribute('color', new THREE.BufferAttribute(new Float32Array(position.count * 3).fill(1), 3));
    ribbons.push(ribbon);
  }
  const merged = new THREE.BufferGeometry();
  const totalVertices = ribbons.reduce((sum, ribbon) => sum + ribbon.attributes.position.count, 0);
  const totalIndices = ribbons.reduce((sum, ribbon) => sum + (ribbon.index as THREE.BufferAttribute).count, 0);
  const positions = new Float32Array(totalVertices * 3);
  const normals = new Float32Array(totalVertices * 3);
  const colors = new Float32Array(totalVertices * 3).fill(1);
  const indices = new Uint32Array(totalIndices);
  let vertexOffset = 0;
  let indexOffset = 0;
  for (const ribbon of ribbons) {
    positions.set(ribbon.attributes.position.array as Float32Array, vertexOffset * 3);
    normals.set(ribbon.attributes.normal.array as Float32Array, vertexOffset * 3);
    const index = ribbon.index as THREE.BufferAttribute;
    for (let i = 0; i < index.count; i++) indices[indexOffset + i] = index.getX(i) + vertexOffset;
    vertexOffset += ribbon.attributes.position.count;
    indexOffset += index.count;
    ribbon.dispose();
  }
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  merged.setIndex(new THREE.BufferAttribute(indices, 1));
  b.mesh(merged, material, 0, 0, 0);
};

/** The transmitter at the centre of the Annex, where all the tape comes down to one place. */
export const transmitter: PropFn = (b) => {
  b.cylinder(1.25, 1.35, 0.3, 0, 0.15, 0, 'metalDark', { segments: 24 });
  b.box(2.2, 1.06, 1, 0, 0.83, 0, 'metalPainted');
  b.box(2.24, 0.06, 1.04, 0, 1.38, 0, 'metalDark');
  b.box(1.9, 0.5, 0.02, 0, 0.92, 0.505, 'metalDark');
  for (let i = 0; i < 6; i++) {
    b.cylinder(0.05, 0.05, 0.02, -0.75 + i * 0.3, 1.02, 0.52, 'metalBrushed', { rx: Math.PI / 2, segments: 12 });
    b.box(0.03, 0.08, 0.02, -0.75 + i * 0.3, 0.8, 0.52, 'plastic');
  }
  // Vacuum tubes, the only warm light in the room.
  const tube = glow(b, 0xffb268, 3.2);
  for (let i = 0; i < 5; i++) {
    const x = -0.6 + i * 0.3;
    b.cylinder(0.048, 0.048, 0.03, x, 1.42, -0.2, 'metalDark', { segments: 10 });
    b.mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.2, 10), tube, x, 1.53, -0.2);
  }
  // A central column carries the tape up into the hoop overhead.
  b.cylinder(0.14, 0.18, 1.9, 0, 2.3, -0.1, 'metalBrushed', { segments: 14 });
  b.box(0.7, 0.03, 0.46, -0.65, 1.42, 0.22, 'metalBrushed');
  for (const x of [-0.82, -0.5]) b.cylinder(0.11, 0.11, 0.016, x, 1.45, 0.22, 'plastic', { segments: 18 });
  b.box(0.4, 0.05, 0.12, 0.6, 1.43, 0.35, 'redPaint');
  b.solid(2.6, 1.5, 2.2, 0, 0.75, 0);
};

export const liftDoors: PropFn = (b) => {
  b.box(3.2, 0.16, 0.14, 0, 2.6, 0.07, 'metalDark');
  for (const x of [-1.52, 1.52]) b.box(0.16, 2.6, 0.14, x, 1.3, 0.07, 'metalDark');
  for (const x of [-0.73, 0.73]) {
    b.box(1.44, 2.52, 0.05, x, 1.26, 0.04, 'steelBlue');
    b.box(1.12, 0.08, 0.012, x, 2.1, 0.07, 'hazard');
    b.box(1.12, 0.08, 0.012, x, 0.42, 0.07, 'hazard');
  }
  b.box(0.2, 0.42, 0.04, 1.86, 1.25, 0.02, 'metalDark');
  b.cylinder(0.025, 0.025, 0.04, 1.86, 1.34, 0.04, 'brass', { rx: Math.PI / 2, segments: 10 });
  b.box(0.08, 0.04, 0.03, 1.86, 1.2, 0.05, 'brass');
};

export const toolbox: PropFn = (b) => {
  b.box(0.55, 0.22, 0.24, 0, 0.11, 0, 'redPaint');
  b.box(0.3, 0.02, 0.02, 0, 0.26, 0, 'metalDark');
  b.box(0.02, 0.05, 0.02, -0.15, 0.24, 0, 'metalDark');
  b.box(0.02, 0.05, 0.02, 0.15, 0.24, 0, 'metalDark');
  b.solid(0.55, 0.26, 0.26, 0, 0.13, 0);
};

export const cableCoil: PropFn = (b) => {
  for (let i = 0; i < 3; i++) b.torus(0.26 - i * 0.015, 0.018, 0, 0.02 + i * 0.03, 0, 'rubber', { rx: Math.PI / 2, segments: 16 });
};

/** One of 41 chairs in the Annex, each with a headset left on its seat. */
export const headsetChair: PropFn = (b) => {
  b.box(0.42, 0.03, 0.4, 0, 0.45, 0, 'metalPainted');
  b.box(0.4, 0.34, 0.03, 0, 0.74, -0.2, 'metalPainted', { rx: -0.1 });
  for (const [x, z] of [
    [-0.18, 0.17],
    [0.18, 0.17],
    [-0.18, -0.18],
    [0.18, -0.18],
  ]) {
    b.box(0.022, 0.45, 0.022, x, 0.225, z, 'metalDark');
  }
  b.torus(0.08, 0.008, 0, 0.5, 0, 'plastic', { rx: 1.2, arc: Math.PI, segments: 10 });
  for (const x of [-0.08, 0.08]) b.cylinder(0.036, 0.036, 0.024, x, 0.49, 0, 'plastic', { segments: 10 });
  b.solid(0.44, 0.9, 0.44, 0, 0.45, -0.02);
};

/** The far end of the tunnel: a blinding slot of open mountain at dawn. */
export const dawnOpening: PropFn = (b) => {
  const material = b.materials.customMaterial('dawn', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const sky = ctx.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, '#6a7ea0');
    sky.addColorStop(0.5, '#e0a884');
    sky.addColorStop(0.72, '#fff0d0');
    sky.addColorStop(1, '#fff6e6');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 256);
    ctx.fillStyle = '#5a5a78';
    ctx.beginPath();
    ctx.moveTo(0, 190);
    const rng = createRng(4);
    for (let x = 0; x <= 512; x += 34) ctx.lineTo(x, 150 + rng() * 60);
    ctx.lineTo(512, 256);
    ctx.lineTo(0, 256);
    ctx.fill();
    ctx.fillStyle = '#f4f0ea';
    ctx.fillRect(0, 214, 512, 42);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const basic = new THREE.MeshBasicMaterial({ map: b.materials.track(texture) });
    basic.color.setScalar(3.4);
    return basic;
  });
  b.plane(4.4, 4.8, 0, 2.3, 0.04, material);
};

export const observationConsole: PropFn = (b) => {
  const width = 6.2;
  b.box(width, 0.05, 0.85, 0, 0.88, 0, 'metalDark');
  b.box(width, 0.86, 0.7, 0, 0.43, -0.05, 'metalPainted');
  const rng = createRng(29);
  for (let i = 0; i < 40; i++) {
    b.box(0.022, 0.012, 0.022, -width / 2 + 0.1 + rng() * (width - 0.2), 0.91, -0.18 + rng() * 0.2, i % 8 === 0 ? 'redPaint' : 'plastic');
  }
  const screens: ['terminal' | 'status' | 'scope', number][] = [
    ['scope', 5],
    ['status', 6],
    ['terminal', 7],
  ];
  screens.forEach(([kind, seed], i) => {
    const x = -1.9 + i * 1.9;
    b.box(0.54, 0.42, 0.34, x, 1.15, -0.2, 'plasticBeige');
    b.plane(0.42, 0.32, x, 1.15, -0.028, screen(b, kind, seed));
  });
  b.box(0.42, 0.02, 0.22, 0.9, 0.92, 0.18, 'paper');
  b.solid(width, 1.2, 0.85, 0, 0.6, 0);
};
