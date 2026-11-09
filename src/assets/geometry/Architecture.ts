// Structural pieces and wall-mounted details that give each room its architecture.

import * as THREE from 'three';
import { createRng, fbm } from '../procedural/Noise';
import {
  clockFaceTexture,
  muralTexture,
  noticeboardTexture,
  plaqueTexture,
  posterTexture,
  signTexture,
  stainTexture,
} from '../procedural/SurfaceArt';
import type { MaterialId, PropArgs } from '../../world/LevelDefinition';
import { PropBuilder } from './PropBuilder';

export interface PropContext {
  x: number;
  z: number;
  floorY: number;
}

export type PropFn = (b: PropBuilder, args: PropArgs, context: PropContext) => void;

const num = (args: PropArgs, key: string, fallback: number): number => {
  const value = args[key];
  return typeof value === 'number' ? value : fallback;
};

const str = (args: PropArgs, key: string, fallback: string): string => {
  const value = args[key];
  return typeof value === 'string' ? value : fallback;
};

/** Emissive material that glows through the bloom pass. Colours above 1 are intentional. */
export function glow(b: PropBuilder, color: number, strength: number): THREE.Material {
  return b.materials.customMaterial(`glow:${color}:${strength}`, () => {
    const material = new THREE.MeshBasicMaterial({ color });
    material.color.multiplyScalar(strength);
    return material;
  });
}

/** Rendering hint shared by flat decals: draw on top of the wall behind without z-fighting. */
function decalMaterial(b: PropBuilder, key: string, texture: () => THREE.Texture, opacity = 1): THREE.Material {
  return b.materials.customMaterial(`decal:${key}`, () =>
    new THREE.MeshStandardMaterial({
      map: b.materials.track(texture()),
      roughness: 0.82,
      transparent: opacity < 1,
      opacity,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    }),
  );
}

export const column: PropFn = (b, args) => {
  const w = num(args, 'w', 0.8);
  const d = num(args, 'd', 0.8);
  const h = num(args, 'h', 3);
  b.box(w, h, d, 0, h / 2, 0, 'concreteBoard');
  b.box(w + 0.1, 0.3, d + 0.1, 0, 0.15, 0, 'concreteDark');
  b.box(w + 0.24, 0.26, d + 0.24, 0, h - 0.13, 0, 'concreteSmooth');
  b.solid(w + 0.1, h, d + 0.1, 0, h / 2, 0);
};

export const beam: PropFn = (b, args) => {
  const w = num(args, 'w', 4);
  const d = num(args, 'd', 0.4);
  const h = num(args, 'h', 0.5);
  b.box(w, h, d, 0, 0, 0, 'concreteSmooth');
};

export const block: PropFn = (b, args) => {
  const w = num(args, 'w', 1);
  const h = num(args, 'h', 1);
  const d = num(args, 'd', 1);
  b.box(w, h, d, 0, h / 2, 0, str(args, 'mat', 'concreteBoard') as MaterialId);
  b.solid(w, h, d, 0, h / 2, 0);
};

function axisRotation(args: PropArgs) {
  return str(args, 'axis', 'x') === 'x' ? { rz: Math.PI / 2 } : { rx: Math.PI / 2 };
}

export const duct: PropFn = (b, args) => {
  const length = num(args, 'length', 6);
  const alongX = str(args, 'axis', 'x') === 'x';
  const size: [number, number, number] = alongX ? [length, 0.42, 0.62] : [0.62, 0.42, length];
  b.box(size[0], size[1], size[2], 0, 0, 0, 'metalBrushed');
  for (let offset = -length / 2 + 0.8; offset < length / 2; offset += 1.6) {
    if (alongX) b.box(0.05, 0.48, 0.68, offset, 0, 0, 'metalDark');
    else b.box(0.68, 0.48, 0.05, 0, 0, offset, 'metalDark');
  }
};

export const pipes: PropFn = (b, args) => {
  const length = num(args, 'length', 6);
  const count = num(args, 'count', 2);
  const alongX = str(args, 'axis', 'x') === 'x';
  const rotation = axisRotation(args);
  const materials: MaterialId[] = ['metalGreen', 'rust', 'metalPainted'];
  for (let i = 0; i < count; i++) {
    const offset = (i - (count - 1) / 2) * 0.19;
    const radius = 0.045 + (i % 2) * 0.022;
    const x = alongX ? 0 : offset;
    const z = alongX ? offset : 0;
    b.cylinder(radius, radius, length, x, 0, z, materials[i % materials.length], { ...rotation, segments: 8 });
    // Collars at regular intervals help a plain pipe read as a pipe.
    for (let c = -length / 2 + 1; c < length / 2; c += 2.1) {
      const cx = alongX ? c : offset;
      const cz = alongX ? offset : c;
      b.cylinder(radius + 0.018, radius + 0.018, 0.06, cx, 0, cz, 'metalDark', { ...rotation, segments: 8 });
    }
  }
  for (let c = -length / 2 + 1.5; c < length / 2; c += 3) {
    if (alongX) b.box(0.05, 0.12, 0.3 + count * 0.15, c, 0.08, 0, 'metalDark');
    else b.box(0.3 + count * 0.15, 0.12, 0.05, 0, 0.08, c, 'metalDark');
  }
};

export const cableTray: PropFn = (b, args) => {
  const length = num(args, 'length', 6);
  const alongX = str(args, 'axis', 'x') === 'x';
  const rng = createRng(length * 100);
  const lx = alongX ? length : 0.42;
  const lz = alongX ? 0.42 : length;
  b.box(lx, 0.02, lz, 0, -0.06, 0, 'metalPainted');
  if (alongX) {
    b.box(length, 0.09, 0.02, 0, -0.02, -0.21, 'metalPainted');
    b.box(length, 0.09, 0.02, 0, -0.02, 0.21, 'metalPainted');
  } else {
    b.box(0.02, 0.09, length, -0.21, -0.02, 0, 'metalPainted');
    b.box(0.02, 0.09, length, 0.21, -0.02, 0, 'metalPainted');
  }
  const rotation = axisRotation(args);
  for (let i = 0; i < 5; i++) {
    const offset = -0.16 + i * 0.08 + (rng() - 0.5) * 0.02;
    const radius = 0.018 + rng() * 0.016;
    b.cylinder(radius, radius, length, alongX ? 0 : offset, -0.024, alongX ? offset : 0, i % 2 ? 'rubber' : 'plastic', {
      ...rotation,
      segments: 6,
    });
  }
};

/** The building's face, seen from the forecourt: a wall of poured concrete around the doors. */
export const facade: PropFn = (b) => {
  const depth = 0.25;
  const z = depth / 2;
  b.box(44, 16, depth, -23.3, 8, z, 'concreteBoard');
  b.box(44, 16, depth, 23.3, 8, z, 'concreteBoard');
  b.box(2.6, 12.9, depth, 0, 9.55, z, 'concreteBoard');
  // Deep vertical fins and a slit window band: a brutalist elevation.
  for (let x = -18; x <= 18; x += 3) {
    if (Math.abs(x) < 3) continue;
    b.box(0.36, 15, 0.6, x, 7.5, 0.5, 'concreteBoard');
  }
  b.box(44, 0.5, 0.5, 0, 12.2, 0.42, 'concreteSmooth');
  b.solid(44, 16, depth, -23.3, 8, z);
  b.solid(44, 16, depth, 23.3, 8, z);
  b.solid(2.6, 12.9, depth, 0, 9.55, z);
};

export const canopy: PropFn = (b) => {
  b.box(9, 0.42, 4.6, 0, 4.1, 0, 'concreteBoard');
  b.box(9.1, 0.14, 4.7, 0, 3.86, 0, 'concreteDark');
  for (const x of [-3.6, 3.6]) {
    b.box(0.42, 3.9, 0.42, x, 1.95, 1.9, 'concreteBoard');
    b.solid(0.5, 3.9, 0.5, x, 1.95, 1.9);
  }
};

/** A lumpy rock face, displaced from a flat grid with the same noise as the textures. */
export const rockWall: PropFn = (b, args) => {
  const length = num(args, 'length', 20);
  const height = 22;
  const geometry = new THREE.PlaneGeometry(length, height, 34, 26);
  const noise = fbm(64, { period: 3, octaves: 4, seed: Math.round(length * 7) });
  const position = geometry.attributes.position as THREE.BufferAttribute;
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const ix = Math.floor(uv.getX(i) * 63.99);
    const iy = Math.floor(uv.getY(i) * 63.99);
    position.setZ(i, (noise[iy * 64 + ix] - 0.3) * 3.2);
    uv.setXY(i, uv.getX(i) * length, uv.getY(i) * height);
  }
  geometry.computeVertexNormals();
  geometry.translate(0, height / 2 - 1, 0);
  b.add(geometry, 'rock');
  b.solid(length, 12, 1.6, 0, 6, -0.4);
};

export const monolith: PropFn = (b) => {
  b.box(2.5, 1.7, 0.42, 0, 0.85, 0, 'concreteBoard');
  b.box(2.6, 0.16, 0.5, 0, 1.72, 0, 'snow');
  b.solid(2.5, 1.7, 0.42, 0, 0.85, 0);
  const material = decalMaterial(b, 'monolith', () => signTexture('HOLLIN RIDGE INSTITUTE', 5, '#a8a596', '#2a2c2b'));
  b.plane(2.2, 0.44, 0, 1.15, 0.216, material);
};

export const bollard: PropFn = (b) => {
  b.cylinder(0.13, 0.15, 0.8, 0, 0.4, 0, 'concreteSmooth', { segments: 10 });
  b.sphere(0.15, 0, 0.82, 0, 'snow', { scaleY: 0.5, segments: 8 });
  b.solid(0.3, 0.8, 0.3, 0, 0.4, 0);
};

export const snowDrift: PropFn = (b) => {
  b.sphere(1.4, 0, -0.18, 0, 'snow', { scaleX: 1.5, scaleY: 0.42, scaleZ: 1, segments: 14 });
  b.sphere(0.8, 0.9, -0.1, 0.5, 'snow', { scaleX: 1.3, scaleY: 0.45, scaleZ: 1.1, segments: 10 });
};

/** The reception hall's upper walkway, out of reach but in view: the Listener stands here. */
export const gallery: PropFn = (b) => {
  b.box(20, 0.42, 3, 0, 4.1, 0, 'concreteBoard');
  b.box(20, 0.12, 3.08, 0, 3.85, 0, 'concreteDark');
  b.box(20, 0.08, 0.1, 0, 5.28, -1.38, 'wood');
  b.box(20, 1, 0.08, 0, 4.82, -1.42, 'glassFrosted');
  for (let x = -9.5; x <= 9.5; x += 2.375) {
    b.box(0.06, 1.1, 0.06, x, 4.8, -1.38, 'metalDark');
  }
  // Beams along the underside, so the entrance passes beneath something heavy.
  for (let x = -8; x <= 8; x += 4) b.box(0.42, 0.32, 3, x, 3.72, 0, 'concreteSmooth');
};

export const radiator: PropFn = (b) => {
  const fins = 14;
  const width = 1.3;
  for (let i = 0; i < fins; i++) {
    b.box(0.05, 0.62, 0.1, -width / 2 + (i + 0.5) * (width / fins), 0.31, 0.05, 'metalPainted');
  }
  b.cylinder(0.02, 0.02, width, 0, 0.56, 0.05, 'metalPainted', { rz: Math.PI / 2, segments: 6 });
  b.cylinder(0.02, 0.02, width, 0, 0.06, 0.05, 'metalPainted', { rz: Math.PI / 2, segments: 6 });
  b.solid(width, 0.7, 0.14, 0, 0.32, 0.05);
};

export const vent: PropFn = (b) => {
  b.box(0.7, 0.4, 0.03, 0, 0, 0.015, 'metalDark');
  for (let i = 0; i < 6; i++) b.box(0.62, 0.025, 0.05, 0, -0.14 + i * 0.056, 0.03, 'metalPainted', { rx: 0.5 });
};

export const fireExt: PropFn = (b) => {
  b.cylinder(0.075, 0.075, 0.46, 0, 0, 0.1, 'redPaint', { segments: 10 });
  b.sphere(0.075, 0, 0.23, 0.1, 'redPaint', { scaleY: 0.5, segments: 10 });
  b.box(0.05, 0.08, 0.1, 0, 0.3, 0.1, 'metalDark');
  b.box(0.2, 0.3, 0.02, 0, 0, 0.01, 'metalDark');
};

export const wallBox: PropFn = (b) => {
  b.box(0.52, 0.72, 0.2, 0, 0, 0.1, 'metalGreen');
  b.box(0.46, 0.66, 0.02, 0, 0, 0.21, 'metalPainted');
  b.box(0.05, 0.14, 0.03, 0.18, 0, 0.23, 'metalDark');
  b.cylinder(0.022, 0.022, 1.6, -0.14, 1.15, 0.05, 'metalPainted', { segments: 6 });
  b.cylinder(0.022, 0.022, 1.6, 0.14, 1.15, 0.05, 'metalPainted', { segments: 6 });
};

export const sign: PropFn = (b, args) => {
  const text = str(args, 'text', '');
  const w = num(args, 'w', 1.2);
  const h = num(args, 'h', 0.24);
  const color = str(args, 'color', '#cfc9b4');
  const bg = str(args, 'bg', '#23272a');
  const material = decalMaterial(b, `sign:${text}:${color}:${bg}`, () => signTexture(text, w / h, color, bg));
  b.box(w + 0.03, h + 0.03, 0.02, 0, 0, 0.01, 'metalDark');
  b.plane(w, h, 0, 0, 0.022, material);
};

export const poster: PropFn = (b, args) => {
  const w = num(args, 'w', 0.9);
  const h = num(args, 'h', 1.25);
  const title = str(args, 'title', 'NOTICE');
  const material = decalMaterial(b, `poster:${title}`, () => posterTexture(title));
  b.box(w + 0.04, h + 0.04, 0.012, 0, 0, 0.006, 'metalDark');
  b.plane(w, h, 0, 0, 0.014, material);
};

export const noticeboard: PropFn = (b) => {
  const material = decalMaterial(b, 'noticeboard', noticeboardTexture);
  b.box(3.06, 1.46, 0.04, 0, 0, 0.02, 'wood');
  b.plane(2.92, 1.32, 0, 0, 0.042, material);
};

/** A wall clock with real hands. Every clock in the building shows 03:17, except when it doesn't. */
export const clock: PropFn = (b, args) => {
  const scale = num(args, 'scale', 1);
  const minute = num(args, 'minute', 17);
  const radius = 0.21 * scale;
  const face = decalMaterial(b, 'clockface', clockFaceTexture);
  b.cylinder(radius + 0.018, radius + 0.018, 0.05, 0, 0, 0.025, 'metalDark', { rx: Math.PI / 2, segments: 24 });
  b.mesh(new THREE.CircleGeometry(radius, 24), face, 0, 0, 0.052);
  const hourAngle = -((3 + minute / 60) / 12) * Math.PI * 2;
  const minuteAngle = -(minute / 60) * Math.PI * 2;
  const hourLength = radius * 0.52;
  const minuteLength = radius * 0.8;
  b.box(0.012 * scale, hourLength, 0.006, Math.sin(-hourAngle) * hourLength * 0.5, Math.cos(hourAngle) * hourLength * 0.5, 0.058, 'plastic', { rz: hourAngle });
  b.box(0.008 * scale, minuteLength, 0.006, Math.sin(-minuteAngle) * minuteLength * 0.5, Math.cos(minuteAngle) * minuteLength * 0.5, 0.062, 'plastic', { rz: minuteAngle });
};

export const mural: PropFn = (b) => {
  const material = decalMaterial(b, 'mural', muralTexture);
  b.box(13, 4.74, 0.14, 0, 0, 0.07, 'concreteDark');
  b.plane(12.6, 4.4, 0, 0, 0.145, material);
};

export const plaque: PropFn = (b) => {
  const material = decalMaterial(b, 'plaque', plaqueTexture);
  (material as THREE.MeshStandardMaterial).metalness = 0.75;
  (material as THREE.MeshStandardMaterial).roughness = 0.42;
  b.box(0.84, 0.54, 0.03, 0, 0, 0.015, 'brass');
  b.plane(0.78, 0.48, 0, 0, 0.032, material);
};

/** Glass with moving snow behind it. The sky material lives in Atmosphere and is shared. */
export const windowProp: PropFn = (b, args) => {
  const w = num(args, 'w', 2);
  const h = num(args, 'h', 1.6);
  const frame = 0.06;
  b.box(w + frame * 2, frame, 0.09, 0, h / 2 + frame / 2, 0.02, 'metalDark');
  b.box(w + frame * 2, frame, 0.09, 0, -h / 2 - frame / 2, 0.02, 'metalDark');
  b.box(frame, h, 0.09, -w / 2 - frame / 2, 0, 0.02, 'metalDark');
  b.box(frame, h, 0.09, w / 2 + frame / 2, 0, 0.02, 'metalDark');
  b.box(0.04, h, 0.06, 0, 0, 0.02, 'metalDark');
  const outside = b.plane(w, h, 0, 0, -0.05, b.materials.customMaterial('windowSky', () => new THREE.MeshBasicMaterial({ color: 0x223040 })));
  outside.userData.windowSky = true;
  b.box(w, h, 0.01, 0, 0, 0.02, 'glass');
};

export const stain: PropFn = (b, args) => {
  const w = num(args, 'w', 1.4);
  const h = num(args, 'h', 1.6);
  const material = b.materials.customMaterial('stain', () =>
    new THREE.MeshBasicMaterial({
      map: b.materials.track(stainTexture()),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      toneMapped: true,
    }),
  );
  b.plane(w, h, 0, 0, 0.012, material);
};

export const floorStripe: PropFn = (b, args) => {
  const length = num(args, 'length', 4);
  const width = num(args, 'width', 0.14);
  const alongX = str(args, 'axis', 'x') === 'x';
  const color = str(args, 'color', '#7c2a1e');
  const lx = alongX ? length : width;
  const lz = alongX ? width : length;
  if (color === 'hazard') {
    b.box(lx, 0.006, lz, 0, 0.004, 0, 'hazard');
    return;
  }
  const material = b.materials.customMaterial(`stripe:${color}`, () =>
    new THREE.MeshStandardMaterial({ color: new THREE.Color(color), roughness: 0.6 }),
  );
  b.mesh(new THREE.BoxGeometry(lx, 0.006, lz), material, 0, 0.004, 0);
};

/** Faint beams of moonlight: stretched additive quads, fading toward the floor. */
export const lightShaft: PropFn = (b, args, context) => {
  const from = new THREE.Vector3(num(args, 'fromX', 0) - context.x, num(args, 'fromY', 6), num(args, 'fromZ', 0) - context.z);
  const to = new THREE.Vector3(num(args, 'toX', 0) - context.x, num(args, 'toY', 0), num(args, 'toZ', 0) - context.z);
  const width = num(args, 'w', 3);
  const direction = to.clone().sub(from);
  const length = direction.length();
  const material = b.materials.customMaterial('lightShaft', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const vertical = ctx.createLinearGradient(0, 0, 0, 256);
    vertical.addColorStop(0, 'rgba(255,255,255,0)');
    vertical.addColorStop(0.15, 'rgba(255,255,255,1)');
    vertical.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = vertical;
    ctx.fillRect(0, 0, 64, 256);
    ctx.globalCompositeOperation = 'destination-in';
    const horizontal = ctx.createLinearGradient(0, 0, 64, 0);
    horizontal.addColorStop(0, 'rgba(0,0,0,0)');
    horizontal.addColorStop(0.5, 'rgba(0,0,0,1)');
    horizontal.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = horizontal;
    ctx.fillRect(0, 0, 64, 256);
    return new THREE.MeshBasicMaterial({
      map: b.materials.track(new THREE.CanvasTexture(canvas)),
      color: 0x8fb2d8,
      transparent: true,
      opacity: 0.1,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
  });
  const middle = from.clone().add(to).multiplyScalar(0.5);
  const up = direction.clone().normalize().negate();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  for (let i = 0; i < 2; i++) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, length), material);
    mesh.position.copy(middle);
    mesh.quaternion.copy(quaternion);
    mesh.rotateY(i * Math.PI * 0.5);
    b.unique.push(mesh);
  }
};

export const cctvCam: PropFn = (b) => {
  b.box(0.04, 0.2, 0.04, 0, 0.14, 0.02, 'metalDark');
  b.box(0.13, 0.11, 0.28, 0, 0.02, 0.15, 'plasticBeige', { rx: 0.45 });
  b.cylinder(0.042, 0.05, 0.05, 0, -0.06, 0.3, 'plastic', { rx: Math.PI / 2 - 0.45, segments: 10 });
  b.sphere(0.012, 0.045, 0.08, 0.1, 'redPaint', { segments: 6 });
};

/** A plain closed steel door on a wall. There is nothing physically behind it. */
export const serviceDoor: PropFn = (b) => {
  const w = 1.1;
  const h = 2.1;
  b.box(w + 0.16, 0.08, 0.1, 0, h + 0.04, 0.05, 'metalDark');
  b.box(0.08, h, 0.1, -w / 2 - 0.04, h / 2, 0.05, 'metalDark');
  b.box(0.08, h, 0.1, w / 2 + 0.04, h / 2, 0.05, 'metalDark');
  b.box(w, h, 0.05, 0, h / 2, 0.03, 'metalGreen');
  b.box(w - 0.3, h - 0.5, 0.012, 0, h / 2, 0.06, 'metalPainted');
  b.box(0.14, 0.05, 0.05, -w / 2 + 0.15, 1.05, 0.08, 'brass');
};
