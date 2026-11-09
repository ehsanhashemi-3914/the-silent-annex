// A small kit for describing an object as a list of simple shapes. Rather than creating
// a mesh per shape, it collects geometry by material so a whole room can later be merged
// into a few draw calls.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { LibraryMaterialId, MaterialLibrary } from '../materials/MaterialLibrary';

export interface ColliderBox {
  center: THREE.Vector3;
  half: THREE.Vector3;
  /** Rotation about the vertical axis. */
  rotationY: number;
}

interface Placement {
  rx?: number;
  ry?: number;
  rz?: number;
}

export interface Spinner {
  mesh: THREE.Mesh;
  speed: number;
  axis: 'x' | 'y' | 'z';
}

const tempMatrix = new THREE.Matrix4();
const tempEuler = new THREE.Euler();
const tempQuat = new THREE.Quaternion();
const tempPos = new THREE.Vector3();
const tempScale = new THREE.Vector3(1, 1, 1);

/** A box whose UVs are measured in metres, so textures keep the same scale on any size. */
export function worldBox(w: number, h: number, d: number): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d);
  const uv = geometry.attributes.uv as THREE.BufferAttribute;
  // BoxGeometry writes its faces in the order +x, -x, +y, -y, +z, -z, with 4 vertices each.
  const faceSizes: [number, number][] = [
    [d, h],
    [d, h],
    [w, d],
    [w, d],
    [w, h],
    [w, h],
  ];
  for (let face = 0; face < 6; face++) {
    const [su, sv] = faceSizes[face];
    for (let v = 0; v < 4; v++) {
      const index = face * 4 + v;
      uv.setXY(index, uv.getX(index) * su, uv.getY(index) * sv);
    }
  }
  return geometry;
}

/** Makes a geometry mergeable with any other: position, normal, uv and colour, and nothing else. */
export function normalizeGeometry(geometry: THREE.BufferGeometry): THREE.BufferGeometry {
  for (const name of Object.keys(geometry.attributes)) {
    if (name !== 'position' && name !== 'normal' && name !== 'uv' && name !== 'color') geometry.deleteAttribute(name);
  }
  const count = geometry.attributes.position.count;
  if (!geometry.attributes.uv) geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
  if (!geometry.attributes.color) {
    geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(count * 3).fill(1), 3));
  }
  if (!geometry.index) {
    const index = new Uint32Array(count);
    for (let i = 0; i < count; i++) index[i] = i;
    geometry.setIndex(new THREE.BufferAttribute(index, 1));
  }
  geometry.morphAttributes = {};
  return geometry;
}

export class PropBuilder {
  readonly parts = new Map<LibraryMaterialId, THREE.BufferGeometry[]>();
  /** Meshes that need their own material or can't be merged. */
  readonly unique: THREE.Object3D[] = [];
  readonly spinners: Spinner[] = [];
  readonly colliders: ColliderBox[] = [];

  constructor(readonly materials: MaterialLibrary) {}

  private matrix(x: number, y: number, z: number, place: Placement = {}, scale?: THREE.Vector3): THREE.Matrix4 {
    tempEuler.set(place.rx ?? 0, place.ry ?? 0, place.rz ?? 0);
    tempQuat.setFromEuler(tempEuler);
    tempPos.set(x, y, z);
    return tempMatrix.compose(tempPos, tempQuat, scale ?? tempScale);
  }

  add(geometry: THREE.BufferGeometry, material: LibraryMaterialId): this {
    normalizeGeometry(geometry);
    const list = this.parts.get(material);
    if (list) list.push(geometry);
    else this.parts.set(material, [geometry]);
    return this;
  }

  /** A box centred at (x, y, z). */
  box(w: number, h: number, d: number, x: number, y: number, z: number, material: LibraryMaterialId, place?: Placement): this {
    const geometry = worldBox(w, h, d);
    geometry.applyMatrix4(this.matrix(x, y, z, place));
    return this.add(geometry, material);
  }

  /** A cylinder along the y-axis unless rotated, centred at (x, y, z). UVs are in metres. */
  cylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    x: number,
    y: number,
    z: number,
    material: LibraryMaterialId,
    options: Placement & { segments?: number; open?: boolean; caps?: boolean } = {},
  ): this {
    const segments = options.segments ?? 12;
    const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments, 1, options.open ?? false);
    const uv = geometry.attributes.uv as THREE.BufferAttribute;
    const circumference = Math.PI * 2 * Math.max(radiusTop, radiusBottom);
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * circumference, uv.getY(i) * height);
    geometry.applyMatrix4(this.matrix(x, y, z, options));
    return this.add(geometry, material);
  }

  sphere(
    radius: number,
    x: number,
    y: number,
    z: number,
    material: LibraryMaterialId,
    options: Placement & { segments?: number; scaleX?: number; scaleY?: number; scaleZ?: number } = {},
  ): this {
    const segments = options.segments ?? 10;
    const geometry = new THREE.SphereGeometry(radius, segments, Math.max(6, Math.round(segments * 0.7)));
    const scale = new THREE.Vector3(options.scaleX ?? 1, options.scaleY ?? 1, options.scaleZ ?? 1);
    geometry.applyMatrix4(this.matrix(x, y, z, options, scale));
    return this.add(geometry, material);
  }

  torus(
    radius: number,
    tube: number,
    x: number,
    y: number,
    z: number,
    material: LibraryMaterialId,
    options: Placement & { arc?: number; segments?: number; tubeSegments?: number } = {},
  ): this {
    const geometry = new THREE.TorusGeometry(radius, tube, options.tubeSegments ?? 6, options.segments ?? 14, options.arc ?? Math.PI * 2);
    geometry.applyMatrix4(this.matrix(x, y, z, options));
    return this.add(geometry, material);
  }

  /** A surface of revolution around the y-axis, from [radius, height] pairs. */
  lathe(profile: [number, number][], x: number, y: number, z: number, material: LibraryMaterialId, options: Placement & { segments?: number } = {}): this {
    // A lathe's faces point outward only when its profile runs upward. Sorting it here means
    // a profile can be written in either direction without turning the surface inside out.
    const ascending = profile[0][1] <= profile[profile.length - 1][1] ? profile : [...profile].reverse();
    const points = ascending.map(([r, h]) => new THREE.Vector2(r, h));
    const geometry = new THREE.LatheGeometry(points, options.segments ?? 14);
    geometry.applyMatrix4(this.matrix(x, y, z, options));
    return this.add(geometry, material);
  }

  /** Adds a mesh with its own material, positioned relative to the prop. */
  mesh(geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, place: Placement = {}): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(place.rx ?? 0, place.ry ?? 0, place.rz ?? 0);
    this.unique.push(mesh);
    return mesh;
  }

  /** A flat rectangle, facing +z, with its own material. */
  plane(w: number, h: number, x: number, y: number, z: number, material: THREE.Material, place: Placement = {}): THREE.Mesh {
    return this.mesh(new THREE.PlaneGeometry(w, h), material, x, y, z, place);
  }

  /** A part that spins for as long as its room is visible, such as a tape reel. */
  spinner(geometry: THREE.BufferGeometry, material: LibraryMaterialId, x: number, y: number, z: number, speed: number, axis: 'x' | 'y' | 'z'): void {
    normalizeGeometry(geometry);
    const mesh = new THREE.Mesh(geometry, this.materials.get(material));
    mesh.position.set(x, y, z);
    this.unique.push(mesh);
    this.spinners.push({ mesh, speed, axis });
  }

  /** Registers a solid box for physics. Centre and half sizes are in prop space. */
  solid(w: number, h: number, d: number, x: number, y: number, z: number, rotationY = 0): this {
    this.colliders.push({
      center: new THREE.Vector3(x, y, z),
      half: new THREE.Vector3(w / 2, h / 2, d / 2),
      rotationY,
    });
    return this;
  }
}

/**
 * Merges a list of same-material geometries into one. Returns null for an empty list.
 * The inputs are disposed of, so they can't be reused afterwards.
 */
export function mergeAndDispose(geometries: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  if (geometries.length === 0) return null;
  const merged = mergeGeometries(geometries, false);
  for (const geometry of geometries) geometry.dispose();
  return merged;
}
