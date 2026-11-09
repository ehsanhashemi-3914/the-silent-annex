// Turns level data into the actual world: visible meshes, collision and interactables.
// Each room's static geometry is merged by material, so a room with hundreds of parts
// costs only as many draw calls as it has distinct materials.

import * as THREE from 'three';
import { glow, type PropFn } from '../assets/geometry/Architecture';
import { createItemModel } from '../assets/geometry/ItemModels';
import { PROP_CATALOG } from '../assets/geometry/PropCatalog';
import { mergeAndDispose, normalizeGeometry, PropBuilder, type Spinner, worldBox } from '../assets/geometry/PropBuilder';
import type { LibraryMaterialId, MaterialLibrary } from '../assets/materials/MaterialLibrary';
import { smoothstep } from '../assets/procedural/Noise';
import type { Condition } from '../core/Script';
import { ItemDatabase } from '../inventory/ItemDatabase';
import type { CollisionManager } from '../physics/CollisionManager';
import type { Collider } from '../physics/PhysicsWorld';
import { DoorRuntime } from './Door';
import { DefInteractable, DoorInteractable } from './InteractiveObjects';
import type { Interactable } from '../interaction/Interactable';
import type { LevelData, LightDef, LinkDef, PropDef, RoomDef, Side } from './LevelDefinition';

export interface Opening {
  at: number;
  width: number;
  bottom: number;
  top: number;
  /** A window keeps the player out, while a door or arch has a clear gap. */
  solid: boolean;
}

export interface DynamicProp {
  condition: Condition;
  group: THREE.Group;
  colliders: Collider[];
  visible: boolean;
}

export interface LightRuntime {
  def: LightDef;
  room: RoomDef;
  position: THREE.Vector3;
  target: THREE.Vector3 | null;
  fixtureMaterial: THREE.MeshBasicMaterial | null;
  fixtureColor: THREE.Color;
  seed: number;
  on: boolean;
  level: number;
}

export interface RoomRuntime {
  def: RoomDef;
  group: THREE.Group;
  lights: LightRuntime[];
  dynamicProps: DynamicProp[];
  spinners: Spinner[];
  /** Models of items lying in this room, by interactable id, so they can vanish when taken. */
  pickupModels: Map<string, THREE.Object3D>;
  feedMonitors: THREE.Mesh[];
  windowSkies: THREE.Mesh[];
}

export interface WorldRuntime {
  rooms: Map<string, RoomRuntime>;
  doors: Map<string, DoorRuntime>;
  interactables: Interactable[];
  root: THREE.Group;
}

const WALL_THICKNESS = 0.15;
const GRID_SIZE = 0.8;
const OPPOSITE: Record<Side, Side> = { n: 's', s: 'n', e: 'w', w: 'e' };

const tempMatrix = new THREE.Matrix4();
const tempEuler = new THREE.Euler();
const tempQuat = new THREE.Quaternion();
const tempPos = new THREE.Vector3();
const tempScale = new THREE.Vector3();

type Parts = Map<LibraryMaterialId, THREE.BufferGeometry[]>;

function pushPart(parts: Parts, material: LibraryMaterialId, geometry: THREE.BufferGeometry): void {
  const list = parts.get(material);
  if (list) list.push(geometry);
  else parts.set(material, [geometry]);
}

/**
 * A subdivided flat rectangle with one vertex colour per corner. The vertex colours act
 * as cheap baked ambient occlusion: corners and edges get darker, which grounds the room
 * far more than the extra vertices cost.
 */
function gridQuad(
  origin: THREE.Vector3,
  uAxis: THREE.Vector3,
  vAxis: THREE.Vector3,
  uLength: number,
  vLength: number,
  uvOrigin: [number, number],
  shade: (point: THREE.Vector3) => number,
): THREE.BufferGeometry {
  const segU = Math.max(1, Math.round(uLength / GRID_SIZE));
  const segV = Math.max(1, Math.round(vLength / GRID_SIZE));
  const vertexCount = (segU + 1) * (segV + 1);
  const positions = new Float32Array(vertexCount * 3);
  const normals = new Float32Array(vertexCount * 3);
  const uvs = new Float32Array(vertexCount * 2);
  const colors = new Float32Array(vertexCount * 3);
  const indices = new Uint32Array(segU * segV * 6);
  const normal = new THREE.Vector3().crossVectors(uAxis, vAxis).normalize();
  const point = new THREE.Vector3();
  let vertex = 0;
  for (let j = 0; j <= segV; j++) {
    const v = (j / segV) * vLength;
    for (let i = 0; i <= segU; i++) {
      const u = (i / segU) * uLength;
      point.copy(origin).addScaledVector(uAxis, u).addScaledVector(vAxis, v);
      positions[vertex * 3] = point.x;
      positions[vertex * 3 + 1] = point.y;
      positions[vertex * 3 + 2] = point.z;
      normals[vertex * 3] = normal.x;
      normals[vertex * 3 + 1] = normal.y;
      normals[vertex * 3 + 2] = normal.z;
      uvs[vertex * 2] = uvOrigin[0] + u;
      uvs[vertex * 2 + 1] = uvOrigin[1] + v;
      const c = shade(point);
      colors[vertex * 3] = c;
      colors[vertex * 3 + 1] = c;
      colors[vertex * 3 + 2] = c;
      vertex++;
    }
  }
  let index = 0;
  for (let j = 0; j < segV; j++) {
    for (let i = 0; i < segU; i++) {
      const a = j * (segU + 1) + i;
      const b = a + 1;
      const c = a + segU + 1;
      const d = c + 1;
      indices[index++] = a;
      indices[index++] = b;
      indices[index++] = d;
      indices[index++] = a;
      indices[index++] = d;
      indices[index++] = c;
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  return geometry;
}

/** Everything needed to place one side of a room's wall, in world coordinates. */
interface WallFrame {
  /** Start of the wall along its length, at floor level, on the room's inside face. */
  corner: THREE.Vector3;
  along: THREE.Vector3;
  length: number;
  /** World coordinate of the wall's start along its axis (x or z). */
  start: number;
  /** Which way a wall face points, into the room. */
  inward: THREE.Vector3;
}

function wallFrame(room: RoomDef, side: Side): WallFrame {
  const [x0, z0, x1, z1] = room.rect;
  const y = room.floorY;
  switch (side) {
    case 'n':
      // Looking north, the wall runs east to west, so u points to -x for a face toward +z.
      return { corner: new THREE.Vector3(x0, y, z0), along: new THREE.Vector3(1, 0, 0), length: x1 - x0, start: x0, inward: new THREE.Vector3(0, 0, 1) };
    case 's':
      return { corner: new THREE.Vector3(x0, y, z1), along: new THREE.Vector3(1, 0, 0), length: x1 - x0, start: x0, inward: new THREE.Vector3(0, 0, -1) };
    case 'e':
      return { corner: new THREE.Vector3(x1, y, z0), along: new THREE.Vector3(0, 0, 1), length: z1 - z0, start: z0, inward: new THREE.Vector3(-1, 0, 0) };
    case 'w':
      return { corner: new THREE.Vector3(x0, y, z0), along: new THREE.Vector3(0, 0, 1), length: z1 - z0, start: z0, inward: new THREE.Vector3(1, 0, 0) };
  }
}

export class WorldBuilder {
  private root = new THREE.Group();

  constructor(
    private level: LevelData,
    private materials: MaterialLibrary,
    private collision: CollisionManager,
  ) {}

  /**
   * Builds the world one room at a time. It's a generator, so that the loading screen
   * can redraw between rooms instead of the page freezing until everything is done.
   */
  *build(): Generator<string, WorldRuntime> {
    const rooms = new Map<string, RoomRuntime>();
    const doors = new Map<string, DoorRuntime>();
    const interactables: Interactable[] = [];
    const roomDefs = new Map(this.level.rooms.map((room) => [room.id, room]));

    const openings = this.collectOpenings();
    for (const def of this.level.rooms) {
      yield def.name;
      rooms.set(def.id, this.buildRoom(def, openings.get(def.id) as Map<Side, Opening[]>));
      for (const interactable of def.interactables) interactables.push(new DefInteractable(interactable, def));
    }
    for (const def of this.level.doors) {
      const door = new DoorRuntime(def, roomDefs.get(def.a) as RoomDef, this.materials, this.collision);
      door.setLockedLook(def.lock.type !== 'none');
      this.root.add(door.group);
      doors.set(def.id, door);
      interactables.push(new DoorInteractable(door));
    }
    for (const link of this.level.links) this.buildLinkDetails(link, roomDefs.get(link.a) as RoomDef);
    return { rooms, doors, interactables, root: this.root };
  }

  /** Doors and links are declared once, but cut a hole in the walls of both rooms. */
  private collectOpenings(): Map<string, Map<Side, Opening[]>> {
    const result = new Map<string, Map<Side, Opening[]>>();
    for (const room of this.level.rooms) {
      result.set(room.id, new Map<Side, Opening[]>([['n', []], ['s', []], ['e', []], ['w', []]]));
    }
    const add = (roomId: string, side: Side, opening: Opening) => {
      (result.get(roomId)?.get(side) as Opening[]).push(opening);
    };
    for (const door of this.level.doors) {
      const opening = { at: door.at, width: door.width, bottom: 0, top: door.height ?? 2.15, solid: false };
      add(door.a, door.side, opening);
      add(door.b, OPPOSITE[door.side], opening);
    }
    for (const link of this.level.links) {
      const opening: Opening = {
        at: link.at,
        width: link.width,
        bottom: link.kind === 'window' ? (link.sill ?? 1) : 0,
        top: link.top ?? 2.4,
        solid: link.kind === 'window',
      };
      add(link.a, link.side, opening);
      add(link.b, OPPOSITE[link.side], opening);
    }
    return result;
  }

  private buildRoom(def: RoomDef, openings: Map<Side, Opening[]>): RoomRuntime {
    const parts: Parts = new Map();
    const group = new THREE.Group();
    group.name = def.id;
    this.root.add(group);

    const runtime: RoomRuntime = {
      def,
      group,
      lights: [],
      dynamicProps: [],
      spinners: [],
      pickupModels: new Map(),
      feedMonitors: [],
      windowSkies: [],
    };

    this.buildFloorAndCeiling(def, parts);
    if (!def.openAir) {
      for (const side of ['n', 's', 'e', 'w'] as Side[]) this.buildWall(def, side, openings.get(side) as Opening[], parts);
    } else {
      this.buildInvisibleBounds(def);
    }

    for (const prop of def.props) {
      if (prop.type === 'foamWalls') this.buildFoam(def, openings, group);
      else if (prop.visibleIf) runtime.dynamicProps.push(this.buildDynamicProp(def, prop, runtime));
      else this.addStaticProp(def, prop, parts, group, runtime);
    }

    this.buildLights(def, runtime, parts, group);
    this.buildPickups(def, runtime);
    this.flush(parts, group);
    return runtime;
  }

  /** Merges everything collected for a room into one mesh per material. */
  private flush(parts: Parts, group: THREE.Group): void {
    for (const [material, geometries] of parts) {
      const merged = mergeAndDispose(geometries.map(normalizeGeometry));
      if (!merged) continue;
      merged.computeBoundingSphere();
      const mesh = new THREE.Mesh(merged, this.materials.get(material));
      const transparent = this.materials.get(material).transparent;
      mesh.castShadow = !transparent;
      mesh.receiveShadow = !transparent;
      mesh.matrixAutoUpdate = false;
      group.add(mesh);
    }
  }

  private buildFloorAndCeiling(room: RoomDef, parts: Parts): void {
    const [x0, z0, x1, z1] = room.rect;
    const y = room.floorY;
    const edgeShade = (point: THREE.Vector3): number => {
      if (room.openAir) return 1;
      const distance = Math.min(point.x - x0, x1 - point.x, point.z - z0, z1 - point.z);
      return 0.42 + 0.58 * smoothstep(0, 1.3, distance);
    };

    // Floors extend past the walls so that door thresholds have something under them.
    const margin = room.openAir ? 40 : 0.2;
    const floor = gridQuad(
      new THREE.Vector3(x0 - margin, y, z1 + margin),
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(0, 0, -1),
      x1 - x0 + margin * 2,
      z1 - z0 + margin * 2,
      [x0 - margin, -(z1 + margin)],
      edgeShade,
    );
    pushPart(parts, room.floor, floor);
    const reach = room.openAir ? 30 : 0.35;
    this.collision.addBounds(x0 - reach, y - 0.6, z0 - reach, x1 + reach, y, z1 + reach);

    if (room.ceiling) {
      const top = y + room.height;
      const ceiling = gridQuad(
        new THREE.Vector3(x0 - 0.1, top, z0 - 0.1),
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(0, 0, 1),
        x1 - x0 + 0.2,
        z1 - z0 + 0.2,
        [x0, z0],
        edgeShade,
      );
      pushPart(parts, room.ceiling, ceiling);
      this.collision.addBounds(x0 - 0.35, top, z0 - 0.35, x1 + 0.35, top + 0.4, z1 + 0.35);
    }
  }

  private buildInvisibleBounds(room: RoomDef): void {
    const [x0, z0, x1, z1] = room.rect;
    const y = room.floorY;
    const h = room.height;
    this.collision.addBounds(x0 - 0.5, y, z0, x0, y + h, z1);
    this.collision.addBounds(x1, y, z0, x1 + 0.5, y + h, z1);
    this.collision.addBounds(x0, y, z1, x1, y + h, z1 + 0.5);
  }

  private buildWall(room: RoomDef, side: Side, openings: Opening[], parts: Parts): void {
    const frame = wallFrame(room, side);
    const sorted = [...openings].sort((a, b) => a.at - b.at);
    let cursor = 0;
    for (const opening of sorted) {
      const from = opening.at - opening.width / 2 - frame.start;
      const to = opening.at + opening.width / 2 - frame.start;
      if (from > cursor) this.wallSpan(room, side, frame, cursor, from, 0, room.height, parts, true);
      // Wall above the opening.
      this.wallSpan(room, side, frame, from, to, opening.top, room.height, parts, true);
      // Wall below a window, plus an invisible barrier in the glass.
      if (opening.solid) {
        this.wallSpan(room, side, frame, from, to, 0, opening.bottom, parts, true);
        this.wallCollider(room, frame, from, to, opening.bottom, opening.top);
      }
      cursor = to;
    }
    if (cursor < frame.length) this.wallSpan(room, side, frame, cursor, frame.length, 0, room.height, parts, true);
  }

  private wallCollider(room: RoomDef, frame: WallFrame, u0: number, u1: number, y0: number, y1: number): void {
    const a = frame.corner.clone().addScaledVector(frame.along, u0);
    const b = frame.corner.clone().addScaledVector(frame.along, u1);
    const out = frame.inward.clone().multiplyScalar(-WALL_THICKNESS * 2);
    this.collision.addBounds(
      Math.min(a.x, b.x, a.x + out.x, b.x + out.x),
      room.floorY + y0,
      Math.min(a.z, b.z, a.z + out.z, b.z + out.z),
      Math.max(a.x, b.x, a.x + out.x, b.x + out.x),
      room.floorY + y1,
      Math.max(a.z, b.z, a.z + out.z, b.z + out.z),
    );
  }

  /** One solid stretch of wall, sliced into bands of its materials, with trim where they meet. */
  private wallSpan(room: RoomDef, side: Side, frame: WallFrame, u0: number, u1: number, y0: number, y1: number, parts: Parts, collide: boolean): void {
    if (u1 - u0 < 0.001 || y1 - y0 < 0.001) return;
    if (collide) this.wallCollider(room, frame, u0, u1, y0, y1);

    const { walls } = room;
    const dado = walls.lower ? (walls.dado ?? 1.2) : 0;

    const shade = (point: THREE.Vector3): number => {
      const height = point.y - room.floorY;
      const fromFloor = 0.6 + 0.4 * smoothstep(0, 0.7, height);
      const fromCeiling = room.ceiling ? 0.6 + 0.4 * smoothstep(0, 1, room.height - height) : 1;
      const along = point.dot(frame.along) - frame.start;
      const fromCorner = 0.66 + 0.34 * smoothstep(0, 0.9, Math.min(along, frame.length - along));
      return fromFloor * fromCeiling * fromCorner;
    };

    // Which way u runs across the face decides the winding, so normals point into the room.
    const flip = side === 'n' || side === 'e';
    const addBand = (material: LibraryMaterialId, bottom: number, top: number) => {
      if (top - bottom < 0.001) return;
      const start = flip ? u0 : u1;
      const direction = flip ? 1 : -1;
      const origin = frame.corner.clone().addScaledVector(frame.along, start);
      origin.y += bottom;
      const uAxis = frame.along.clone().multiplyScalar(direction);
      const vAxis = new THREE.Vector3(0, 1, 0);
      // Offset the UVs per wall so a texture doesn't line up identically everywhere.
      const uvU = (flip ? u0 : -u1) + frame.corner.x * 0.37 + frame.corner.z * 0.61;
      const geometry = gridQuad(origin, uAxis, vAxis, u1 - u0, top - bottom, [uvU, bottom], shade);
      // The cross product of u and v has to face into the room for correct lighting.
      const normal = new THREE.Vector3().crossVectors(uAxis, vAxis);
      if (normal.dot(frame.inward) < 0) {
        const index = geometry.index as THREE.BufferAttribute;
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i + 1);
          index.setX(i + 1, index.getX(i + 2));
          index.setX(i + 2, a);
        }
        const normals = geometry.attributes.normal as THREE.BufferAttribute;
        for (let i = 0; i < normals.count; i++) normals.setXYZ(i, frame.inward.x, frame.inward.y, frame.inward.z);
      }
      pushPart(parts, material, geometry);
    };

    if (walls.lower && y0 < dado) {
      addBand(walls.lower, y0, Math.min(dado, y1));
      addBand(walls.upper, Math.max(dado, y0), y1);
      if (y1 >= dado) this.trim(frame, room, u0, u1, dado, 0.05, 0.025, 'woodDark', parts);
    } else {
      addBand(walls.upper, y0, y1);
    }
    if (walls.skirting && y0 === 0) this.trim(frame, room, u0, u1, 0.07, 0.14, 0.022, walls.skirting, parts);
  }

  /** A strip of moulding along a wall: a chair rail or skirting board. */
  private trim(frame: WallFrame, room: RoomDef, u0: number, u1: number, y: number, height: number, depth: number, material: LibraryMaterialId, parts: Parts): void {
    const length = u1 - u0;
    const middle = frame.corner.clone().addScaledVector(frame.along, u0 + length / 2);
    middle.addScaledVector(frame.inward, depth / 2);
    const alongX = Math.abs(frame.along.x) > 0.5;
    const geometry = worldBox(alongX ? length : depth, height, alongX ? depth : length);
    geometry.translate(middle.x, room.floorY + y, middle.z);
    pushPart(parts, material, normalizeGeometry(geometry));
  }

  /** Lines the thickness of a wall at an arch or window, and adds the window's glass. */
  private buildLinkDetails(link: LinkDef, roomA: RoomDef): void {
    const parts: Parts = new Map();
    const [x0, z0, x1, z1] = roomA.rect;
    const gap = 0.3;
    const horizontal = link.side === 'n' || link.side === 's';
    const planeCoord = link.side === 'n' ? z0 - gap / 2 : link.side === 's' ? z1 + gap / 2 : link.side === 'e' ? x1 + gap / 2 : x0 - gap / 2;
    const floorY = roomA.floorY;
    const bottom = link.kind === 'window' ? (link.sill ?? 1) : 0;
    const top = link.top ?? 2.4;
    const height = top - bottom;
    const material: LibraryMaterialId = link.kind === 'window' ? 'metalDark' : 'concreteSmooth';
    const thickness = link.kind === 'window' ? 0.09 : 0.06;
    const depth = gap + 0.06;

    const place = (w: number, h: number, d: number, along: number, y: number, partsMaterial: LibraryMaterialId) => {
      const geometry = horizontal ? worldBox(w, h, d) : worldBox(d, h, w);
      if (horizontal) geometry.translate(link.at + along, floorY + y, planeCoord);
      else geometry.translate(planeCoord, floorY + y, link.at + along);
      pushPart(parts, partsMaterial, normalizeGeometry(geometry));
    };

    const half = link.width / 2;
    place(thickness, height, depth, -half + thickness / 2, bottom + height / 2, material);
    place(thickness, height, depth, half - thickness / 2, bottom + height / 2, material);
    place(link.width, thickness, depth, 0, top - thickness / 2, material);
    if (link.kind === 'window') {
      place(link.width, thickness, depth, 0, bottom + thickness / 2, material);
      place(link.width, height, 0.02, 0, bottom + height / 2, link.side === 'n' && roomA.id === 'observation' ? 'glassDark' : 'glass');
      const mullions = Math.round(link.width / 1.2);
      for (let i = 1; i < mullions; i++) place(0.05, height, 0.06, -half + (i / mullions) * link.width, bottom + height / 2, 'metalDark');
    } else {
      // A floor threshold across the gap.
      place(link.width, 0.012, depth, 0, 0.006, 'concreteDark');
    }
    const group = new THREE.Group();
    this.flush(parts, group);
    this.root.add(group);
  }

  private buildProp(room: RoomDef, prop: PropDef): PropBuilder {
    const builder = new PropBuilder(this.materials);
    const fn: PropFn = PROP_CATALOG[prop.type];
    fn(builder, prop.args ?? {}, { x: prop.x, z: prop.z, floorY: room.floorY });
    return builder;
  }

  private propMatrix(room: RoomDef, prop: PropDef): THREE.Matrix4 {
    tempEuler.set(0, prop.rot ?? 0, 0);
    tempQuat.setFromEuler(tempEuler);
    tempPos.set(prop.x, room.floorY + (prop.y ?? 0), prop.z);
    tempScale.setScalar(prop.scale ?? 1);
    return tempMatrix.compose(tempPos, tempQuat, tempScale);
  }

  /** Darkens the parts of a prop near the floor, so it looks like it's sitting on something. */
  private shadeProp(geometry: THREE.BufferGeometry, room: RoomDef): void {
    const position = geometry.attributes.position as THREE.BufferAttribute;
    const color = geometry.attributes.color as THREE.BufferAttribute;
    for (let i = 0; i < position.count; i++) {
      const height = position.getY(i) - room.floorY;
      const shade = 0.55 + 0.45 * smoothstep(0, 0.5, height);
      color.setXYZ(i, color.getX(i) * shade, color.getY(i) * shade, color.getZ(i) * shade);
    }
  }

  private addStaticProp(room: RoomDef, prop: PropDef, parts: Parts, group: THREE.Group, runtime: RoomRuntime): void {
    const builder = this.buildProp(room, prop);
    const matrix = this.propMatrix(room, prop);
    for (const [material, geometries] of builder.parts) {
      for (const geometry of geometries) {
        geometry.applyMatrix4(matrix);
        normalizeGeometry(geometry);
        this.shadeProp(geometry, room);
        pushPart(parts, material, geometry);
      }
    }
    this.attachUnique(builder, matrix, group, runtime);
    if (!prop.noCollide && builder.colliders.length > 0) {
      this.collision.addPropColliders(builder.colliders, prop.x, room.floorY + (prop.y ?? 0), prop.z, prop.rot ?? 0, prop.scale ?? 1);
    }
  }

  private attachUnique(builder: PropBuilder, matrix: THREE.Matrix4, group: THREE.Group, runtime: RoomRuntime): void {
    for (const object of builder.unique) {
      object.applyMatrix4(matrix);
      group.add(object);
      if (object instanceof THREE.Mesh) {
        if (object.userData.feedIndex !== undefined) runtime.feedMonitors.push(object);
        if (object.userData.windowSky) runtime.windowSkies.push(object);
      }
    }
    runtime.spinners.push(...builder.spinners);
  }

  private buildDynamicProp(room: RoomDef, prop: PropDef, runtime: RoomRuntime): DynamicProp {
    const builder = this.buildProp(room, prop);
    const group = new THREE.Group();
    const matrix = this.propMatrix(room, prop);
    const parts: Parts = new Map();
    for (const [material, geometries] of builder.parts) {
      for (const geometry of geometries) {
        geometry.applyMatrix4(matrix);
        normalizeGeometry(geometry);
        this.shadeProp(geometry, room);
        pushPart(parts, material, geometry);
      }
    }
    this.flush(parts, group);
    this.attachUnique(builder, matrix, group, runtime);
    group.visible = false;
    runtime.group.add(group);
    const colliders = prop.noCollide
      ? []
      : this.collision.addPropColliders(builder.colliders, prop.x, room.floorY + (prop.y ?? 0), prop.z, prop.rot ?? 0, prop.scale ?? 1);
    this.collision.setEnabled(colliders, false);
    return { condition: prop.visibleIf as Condition, group, colliders, visible: false };
  }

  /** Acoustic foam: thousands of identical wedges, drawn as one instanced mesh. */
  private buildFoam(room: RoomDef, openings: Map<Side, Opening[]>, group: THREE.Group): void {
    const large = room.height > 8;
    const spacing = large ? 1.1 : 0.62;
    const depth = large ? 0.85 : 0.42;
    const wedge = normalizeGeometry(
      new THREE.ConeGeometry((spacing / 2) * Math.SQRT2 * 0.98, depth, 4, 1).rotateY(Math.PI / 4).translate(0, depth / 2, 0),
    );
    const flat = wedge.toNonIndexed();
    flat.computeVertexNormals();
    normalizeGeometry(flat);

    const [x0, z0, x1, z1] = room.rect;
    const y = room.floorY;
    const matrices: THREE.Matrix4[] = [];
    const rotation = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3(1, 1, 1);
    const up = new THREE.Vector3(0, 1, 0);

    const blocked = (side: Side, along: number, height: number): boolean => {
      for (const opening of openings.get(side) as Opening[]) {
        const margin = spacing * 0.65;
        if (Math.abs(along - opening.at) < opening.width / 2 + margin && height > opening.bottom - margin && height < opening.top + margin) return true;
      }
      return false;
    };

    const addWall = (side: Side, inward: THREE.Vector3, start: number, end: number, fixed: number, alongX: boolean) => {
      rotation.setFromUnitVectors(up, inward);
      for (let along = start + spacing / 2; along < end; along += spacing) {
        for (let height = spacing / 2 + 0.3; height < room.height; height += spacing) {
          if (blocked(side, along, height)) continue;
          position.set(alongX ? along : fixed, y + height, alongX ? fixed : along);
          matrices.push(new THREE.Matrix4().compose(position, rotation, scale));
        }
      }
    };
    addWall('n', new THREE.Vector3(0, 0, 1), x0, x1, z0, true);
    addWall('s', new THREE.Vector3(0, 0, -1), x0, x1, z1, true);
    addWall('w', new THREE.Vector3(1, 0, 0), z0, z1, x0, false);
    addWall('e', new THREE.Vector3(-1, 0, 0), z0, z1, x1, false);
    rotation.setFromUnitVectors(up, new THREE.Vector3(0, -1, 0));
    for (let x = x0 + spacing / 2; x < x1; x += spacing) {
      for (let z = z0 + spacing / 2; z < z1; z += spacing) {
        position.set(x, y + room.height, z);
        matrices.push(new THREE.Matrix4().compose(position, rotation, scale));
      }
    }

    const mesh = new THREE.InstancedMesh(flat, this.materials.get('foam'), matrices.length);
    const color = new THREE.Color();
    matrices.forEach((matrix, i) => {
      mesh.setMatrixAt(i, matrix);
      const e = matrix.elements;
      // Darken the wedges near the floor. Slight variation keeps the rows from looking printed.
      const shade = (0.55 + 0.45 * smoothstep(0, 3, e[13] - y)) * (0.84 + ((i * 7919) % 100) * 0.0016);
      mesh.setColorAt(i, color.setScalar(shade));
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    group.add(mesh);

    // The player stops at the wedge tips rather than walking into them, except at doorways.
    const inset = depth * 0.8;
    const barrier = (side: Side, start: number, end: number, fixed0: number, fixed1: number, alongX: boolean) => {
      const add = (from: number, to: number) => {
        if (alongX) this.collision.addBounds(from, y, fixed0, to, y + room.height, fixed1);
        else this.collision.addBounds(fixed0, y, from, fixed1, y + room.height, to);
      };
      const doorways = (openings.get(side) as Opening[]).filter((opening) => !opening.solid).sort((a, b) => a.at - b.at);
      let cursor = start;
      for (const doorway of doorways) {
        const from = doorway.at - doorway.width / 2;
        if (from > cursor) add(cursor, from);
        cursor = doorway.at + doorway.width / 2;
      }
      if (cursor < end) add(cursor, end);
    };
    barrier('n', x0, x1, z0, z0 + inset, true);
    barrier('s', x0, x1, z1 - inset, z1, true);
    barrier('w', z0, z1, x0, x0 + inset, false);
    barrier('e', z0, z1, x1 - inset, x1, false);
  }

  private buildLights(room: RoomDef, runtime: RoomRuntime, parts: Parts, group: THREE.Group): void {
    let seed = room.id.length * 13;
    for (const def of room.lights) {
      seed += 7.31;
      const position = new THREE.Vector3(def.pos[0], def.pos[1] + room.floorY, def.pos[2]);
      const target = def.target ? new THREE.Vector3(def.target[0], def.target[1] + room.floorY, def.target[2]) : null;
      const fixtureMaterial = this.buildFixture(def, position, room, parts, group);
      runtime.lights.push({
        def,
        room,
        position,
        target,
        fixtureMaterial,
        fixtureColor: new THREE.Color(def.color),
        seed,
        on: false,
        level: 0,
      });
    }
  }

  private buildFixture(def: LightDef, position: THREE.Vector3, room: RoomDef, parts: Parts, group: THREE.Group): THREE.MeshBasicMaterial | null {
    const kind = def.fixture ?? 'none';
    if (kind === 'none') return null;
    const material = new THREE.MeshBasicMaterial({ color: def.color });
    this.materials.track(material);
    const b = new PropBuilder(this.materials);
    const top = room.floorY + room.height;
    let glowMesh: THREE.Mesh;
    switch (kind) {
      case 'fluoro': {
        const ceilingGap = top - position.y;
        const [lx, lz] = def.alongX ? [1.3, 0.2] : [0.2, 1.3];
        b.box(lx + 0.04, 0.05, lz + 0.04, 0, ceilingGap - 0.025, 0, 'metalPainted');
        glowMesh = new THREE.Mesh(new THREE.BoxGeometry(lx - 0.06, 0.04, lz - 0.06), material);
        glowMesh.position.set(0, ceilingGap - 0.07, 0);
        break;
      }
      case 'bulkhead':
        b.box(0.34, 0.2, 0.1, 0, 0, 0, 'metalDark');
        for (let i = 0; i < 3; i++) b.box(0.3, 0.012, 0.12, 0, -0.06 + i * 0.06, 0, 'metalDark');
        glowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.06), material);
        break;
      case 'pendant': {
        const cord = top - position.y;
        b.cylinder(0.008, 0.008, cord, 0, cord / 2, 0, 'plastic', { segments: 5 });
        b.cylinder(0.08, 0.34, 0.26, 0, 0.1, 0, 'metalDark', { segments: 14, open: true });
        glowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), material);
        glowMesh.position.y = -0.02;
        break;
      }
      case 'emergency':
        b.box(0.32, 0.12, 0.14, 0, 0.1, 0, 'plasticBeige');
        glowMesh = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.06, 0.11), material);
        glowMesh.position.y = 0.03;
        break;
      case 'caged': {
        const cord = top - position.y;
        b.cylinder(0.006, 0.006, cord, 0, cord / 2, 0, 'plastic', { segments: 5 });
        for (let i = 0; i < 3; i++) b.torus(0.07, 0.004, 0, 0.05 - i * 0.05, 0, 'metalDark', { rx: Math.PI / 2, segments: 12 });
        glowMesh = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), material);
        break;
      }
      default:
        return null;
    }
    const holder = new THREE.Group();
    holder.position.copy(position);
    for (const [partMaterial, geometries] of b.parts) {
      for (const geometry of geometries) {
        geometry.translate(position.x, position.y, position.z);
        pushPart(parts, partMaterial, normalizeGeometry(geometry));
      }
    }
    holder.add(glowMesh);
    group.add(holder);
    return material;
  }

  private buildPickups(room: RoomDef, runtime: RoomRuntime): void {
    for (const def of room.interactables) {
      if (def.kind !== 'pickup' || def.hideModel) continue;
      const item = ItemDatabase.get(def.itemId);
      if (!item) continue;
      const model = createItemModel(item.model, this.materials);
      // Items are small, so they're scaled up a little to read clearly at a distance.
      model.scale.setScalar(1.25);
      model.position.set(def.pos[0], def.pos[1] + room.floorY - 0.02, def.pos[2]);
      model.rotation.y = (def.id.length * 1.7) % 6.28;
      // A small highlight, so that pickups stand out in the dark without an obvious marker.
      const builder = new PropBuilder(this.materials);
      const spark = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), glow(builder, 0xfff2d0, 6));
      spark.position.set(0.02, 0.05, 0.02);
      model.add(spark);
      runtime.group.add(model);
      runtime.pickupModels.set(def.id, model);
    }
  }
}
