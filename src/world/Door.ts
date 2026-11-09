// A door in the world: its frame, moving parts, collision and indicator lamp. Whether it
// may open is decided by InteractionLogic. This class only makes it look and act open.

import * as THREE from 'three';
import { glow } from '../assets/geometry/Architecture';
import { cardReader, keypad } from '../assets/geometry/Equipment';
import { signTexture } from '../assets/procedural/SurfaceArt';
import { PropBuilder } from '../assets/geometry/PropBuilder';
import type { LibraryMaterialId, MaterialLibrary } from '../assets/materials/MaterialLibrary';
import type { CollisionManager } from '../physics/CollisionManager';
import type { Collider } from '../physics/PhysicsWorld';
import type { DoorDef, RoomDef } from './LevelDefinition';

const DEFAULT_HEIGHT = 2.15;
const FRAME_DEPTH = 0.36;

/** Seconds each door style takes to open. Heavier doors move more slowly. */
const OPEN_TIME: Record<DoorDef['style'], number> = {
  wood: 0.75,
  steel: 0.8,
  double: 1.1,
  slide: 1.3,
  blast: 5.5,
  hatch: 0.7,
};

interface Moving {
  object: THREE.Object3D;
  /** Applies an open amount (0 to 1) to this part. */
  apply: (object: THREE.Object3D, amount: number) => void;
}

/** Works out where a door or opening sits in the world from the wall it's in. */
export function doorPlacement(room: RoomDef, side: DoorDef['side'], at: number): { x: number; z: number; rotY: number } {
  const [x0, z0, x1, z1] = room.rect;
  const gap = 0.15;
  switch (side) {
    case 'n':
      return { x: at, z: z0 - gap, rotY: 0 };
    case 's':
      return { x: at, z: z1 + gap, rotY: 0 };
    case 'e':
      return { x: x1 + gap, z: at, rotY: Math.PI / 2 };
    case 'w':
      return { x: x0 - gap, z: at, rotY: Math.PI / 2 };
  }
}

function buildParts(b: PropBuilder, group: THREE.Object3D, materials: MaterialLibrary): void {
  for (const [material, geometries] of b.parts) {
    for (const geometry of geometries) {
      const mesh = new THREE.Mesh(geometry, materials.get(material as LibraryMaterialId));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
    }
  }
  for (const object of b.unique) group.add(object);
}

export class DoorRuntime {
  readonly group = new THREE.Group();
  readonly center = new THREE.Vector3();
  isOpen = false;
  private amount = 0;
  private target = 0;
  private moving: Moving[] = [];
  private colliders: Collider[] = [];
  private lamps: THREE.Mesh[] = [];
  private lampRed: THREE.Material;
  private lampGreen: THREE.Material;

  constructor(
    readonly def: DoorDef,
    roomA: RoomDef,
    private materials: MaterialLibrary,
    collision: CollisionManager,
  ) {
    const { x, z, rotY } = doorPlacement(roomA, def.side, def.at);
    const floorY = roomA.floorY;
    this.group.position.set(x, floorY, z);
    this.group.rotation.y = rotY;
    this.center.set(x, floorY + 1.2, z);

    const height = def.height ?? DEFAULT_HEIGHT;
    const helper = new PropBuilder(materials);
    this.lampRed = glow(helper, 0xff2a18, 5);
    this.lampGreen = glow(helper, 0x38ff84, 4);

    this.buildFrame(height);
    this.buildLeaves(height);

    const hx = rotY === 0 ? def.width / 2 : 0.1;
    const hz = rotY === 0 ? 0.1 : def.width / 2;
    this.colliders.push(collision.addBox(x, floorY + height / 2, z, hx, height / 2, hz));
  }

  private buildFrame(height: number): void {
    const { width, style } = this.def;
    const b = new PropBuilder(this.materials);
    const frame: LibraryMaterialId = style === 'wood' ? 'woodDark' : style === 'double' ? 'metalBrushed' : 'metalDark';
    const post = style === 'blast' ? 0.34 : style === 'slide' ? 0.2 : 0.09;
    const head = style === 'blast' ? 0.5 : post;
    const depth = style === 'blast' ? 0.9 : FRAME_DEPTH;
    b.box(post, height + head, depth, -width / 2 - post / 2, (height + head) / 2, 0, frame);
    b.box(post, height + head, depth, width / 2 + post / 2, (height + head) / 2, 0, frame);
    b.box(width, head, depth, 0, height + head / 2, 0, frame);
    b.box(width, 0.012, depth, 0, 0.004, 0, 'metalBrushed');

    if (style === 'blast') {
      b.box(width + 1.4, 0.18, 0.5, 0, height + 0.5, 0, 'hazard');
      for (let i = 0; i < 6; i++) {
        const y = 0.3 + i * 0.5;
        for (const side of [-1, 1]) {
          b.cylinder(0.05, 0.05, 0.92, (side * width) / 2 + side * 0.17, y, 0, 'metalBrushed', { rx: Math.PI / 2, segments: 8 });
        }
      }
    }

    // Card readers and keypads sit beside the door, on both faces of the wall.
    const lock = this.def.lock;
    const showsReader = (lock.type === 'key' && style === 'slide') || lock.type === 'keypad';
    const lampX = width / 2 + 0.26;
    if (showsReader) {
      for (const face of [1, -1]) {
        const panel = new PropBuilder(this.materials);
        if (lock.type === 'keypad') keypad(panel, {}, { x: 0, z: 0, floorY: 0 });
        else cardReader(panel, {}, { x: 0, z: 0, floorY: 0 });
        const holder = new THREE.Group();
        holder.position.set(lampX * 1.02, 1.28, (face * (FRAME_DEPTH + 0.01)) / 2);
        if (face < 0) holder.rotation.y = Math.PI;
        buildParts(panel, holder, this.materials);
        this.group.add(holder);
      }
    }

    // A status lamp on each face for anything that can be locked.
    if (lock.type !== 'none') {
      for (const face of [1, -1]) {
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), this.lampRed);
        lamp.position.set(lampX * 1.02, 1.5, (face * (FRAME_DEPTH + 0.02)) / 2);
        this.lamps.push(lamp);
        this.group.add(lamp);
      }
    }

    if (this.def.label) {
      const label = this.def.label;
      const material = this.materials.customMaterial(`doorlabel:${label}`, () =>
        new THREE.MeshStandardMaterial({ map: this.materials.track(signTexture(label, 5, '#d4cfbc', '#1f1d19')), roughness: 0.6 }),
      );
      for (const face of [1, -1]) {
        const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.16), material);
        plate.position.set(0, height + head + 0.14, (face * FRAME_DEPTH) / 2 + face * 0.002);
        if (face < 0) plate.rotation.y = Math.PI;
        this.group.add(plate);
      }
    }
    buildParts(b, this.group, this.materials);
  }

  private buildLeaves(height: number): void {
    const { width, style } = this.def;
    switch (style) {
      case 'wood':
        this.addSwing(width, height, -width / 2, 1, (b, w, h) => {
          b.box(w, h, 0.05, w / 2, h / 2, 0, 'woodDark');
          b.box(w - 0.3, h * 0.42, 0.058, w / 2, h * 0.7, 0, 'glassFrosted');
          b.box(w - 0.24, 0.03, 0.06, w / 2, h * 0.49, 0, 'wood');
          this.addHandle(b, w - 0.1, 1);
        });
        break;
      case 'steel':
        this.addSwing(width, height, -width / 2, 1, (b, w, h) => {
          b.box(w, h, 0.055, w / 2, h / 2, 0, 'metalGreen');
          b.box(0.34, 0.44, 0.062, w / 2, h * 0.72, 0, 'glassDark');
          b.box(0.4, 0.5, 0.05, w / 2, h * 0.72, 0, 'metalDark');
          b.box(w - 0.08, 0.26, 0.06, w / 2, 0.15, 0, 'metalBrushed');
          this.addHandle(b, w - 0.1, 1);
        });
        break;
      case 'double':
        this.addSwing(width / 2, height, -width / 2, 1, (b, w, h) => {
          b.box(w, 0.14, 0.06, w / 2, 0.1, 0, 'metalBrushed');
          b.box(w, 0.1, 0.06, w / 2, h - 0.05, 0, 'metalBrushed');
          b.box(0.08, h, 0.06, 0.04, h / 2, 0, 'metalBrushed');
          b.box(0.08, h, 0.06, w - 0.04, h / 2, 0, 'metalBrushed');
          b.box(w - 0.16, h - 0.24, 0.02, w / 2, h / 2 + 0.02, 0, 'glassFrosted');
          b.box(0.03, 0.7, 0.05, w - 0.12, 1.1, 0.05, 'brass');
        });
        this.addSwing(width / 2, height, width / 2, -1, (b, w, h) => {
          b.box(w, 0.14, 0.06, -w / 2, 0.1, 0, 'metalBrushed');
          b.box(w, 0.1, 0.06, -w / 2, h - 0.05, 0, 'metalBrushed');
          b.box(0.08, h, 0.06, -0.04, h / 2, 0, 'metalBrushed');
          b.box(0.08, h, 0.06, -w + 0.04, h / 2, 0, 'metalBrushed');
          b.box(w - 0.16, h - 0.24, 0.02, -w / 2, h / 2 + 0.02, 0, 'glassFrosted');
          b.box(0.03, 0.7, 0.05, -w + 0.12, 1.1, 0.05, 'brass');
        });
        break;
      case 'slide':
        this.addSlide(width, height, 0, width - 0.08, (b, w, h) => {
          b.box(w, h, 0.09, 0, h / 2, 0, 'steelBlue');
          b.box(w, 0.14, 0.094, 0, 0.42, 0, 'hazard');
          b.box(0.62, 0.42, 0.1, 0, h * 0.72, 0, 'glassDark');
          b.box(0.72, 0.5, 0.086, 0, h * 0.72, 0, 'metalDark');
        });
        break;
      case 'blast': {
        const half = width / 2;
        const build =
          (side: number) =>
          (b: PropBuilder, w: number, h: number): void => {
            b.box(w, h, 0.5, 0, h / 2, 0, 'metalDark');
            b.box(w - 0.1, h - 0.3, 0.52, 0, h / 2, 0, 'steelBlue');
            for (let i = 0; i < 4; i++) {
              b.box(w, 0.08, 0.55, 0, 0.4 + i * 0.8, 0, 'metalBrushed');
            }
            b.box(0.09, h, 0.56, (-side * w) / 2 + side * 0.05, h / 2, 0, 'hazard');
          };
        this.addSlide(half, height, -half / 2, -half + 0.02, build(-1));
        this.addSlide(half, height, half / 2, half - 0.02, build(1));
        break;
      }
      case 'hatch':
        this.addSwing(width, height, -width / 2, 1, (b, w, h) => {
          b.box(w, h, 0.06, w / 2, h / 2, 0, 'metalPainted');
          b.box(w - 0.16, h - 0.16, 0.012, w / 2, h / 2, 0.034, 'metalDark');
          b.box(0.12, 0.05, 0.06, w - 0.15, h * 0.5, 0.05, 'metalBrushed');
          b.box(0.12, 0.05, 0.06, w - 0.15, h * 0.5, -0.05, 'metalBrushed');
        });
        break;
    }
  }

  private addHandle(b: PropBuilder, x: number, direction: number): void {
    for (const side of [1, -1]) {
      b.box(0.04, 0.09, 0.012, x, 1.02, (side * 0.055) / 2, 'brass');
      b.box(0.11, 0.018, 0.018, x - (direction * 0.05), 1.04, side * 0.055, 'brass');
    }
  }

  private addSwing(
    width: number,
    height: number,
    hingeX: number,
    direction: number,
    build: (b: PropBuilder, width: number, height: number) => void,
  ): void {
    const pivot = new THREE.Group();
    pivot.position.set(hingeX, 0, 0);
    const b = new PropBuilder(this.materials);
    build(b, width, height);
    buildParts(b, pivot, this.materials);
    this.group.add(pivot);
    const maxAngle = direction * 1.72;
    this.moving.push({
      object: pivot,
      apply: (object, amount) => {
        object.rotation.y = -maxAngle * amount;
      },
    });
  }

  private addSlide(
    width: number,
    height: number,
    x: number,
    travel: number,
    build: (b: PropBuilder, width: number, height: number) => void,
  ): void {
    const leaf = new THREE.Group();
    leaf.position.set(x, 0, 0);
    const b = new PropBuilder(this.materials);
    build(b, width, height);
    buildParts(b, leaf, this.materials);
    this.group.add(leaf);
    this.moving.push({
      object: leaf,
      apply: (object, amount) => {
        object.position.x = x + travel * amount;
      },
    });
  }

  /** Moves the door. With instant set, it jumps straight there, as when loading a save. */
  setOpen(open: boolean, instant = false): void {
    this.isOpen = open;
    this.target = open ? 1 : 0;
    // Collision clears as soon as a door starts opening, so the player can never get stuck on it.
    for (const collider of this.colliders) collider.setEnabled(!open);
    if (instant) {
      this.amount = this.target;
      for (const part of this.moving) part.apply(part.object, this.amount);
    }
  }

  setLockedLook(locked: boolean): void {
    for (const lamp of this.lamps) lamp.material = locked ? this.lampRed : this.lampGreen;
  }

  update(dt: number): void {
    if (this.amount === this.target) return;
    const rate = dt / OPEN_TIME[this.def.style];
    this.amount = this.target > this.amount ? Math.min(this.target, this.amount + rate) : Math.max(this.target, this.amount - rate);
    // Ease in and out, so the door has some weight to it.
    const eased = this.amount * this.amount * (3 - 2 * this.amount);
    for (const part of this.moving) part.apply(part.object, eased);
  }
}
