// Keeps the 3D world in step with the game state: which rooms are drawn, which doors
// stand open, which props have changed. Everything the world shows comes from the
// session, so loading a save only takes one call to syncAll.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { MaterialLibrary } from '../assets/materials/MaterialLibrary';
import type { CollisionManager } from '../physics/CollisionManager';
import type { Atmosphere } from '../rendering/Atmosphere';
import type { LightingManager } from '../rendering/LightingManager';
import type { LevelData, RoomDef } from '../world/LevelDefinition';
import { WorldBuilder, type RoomRuntime, type WorldRuntime } from '../world/WorldBuilder';
import type { GameSession } from './GameSession';

const FOG_RATE = 1.6;

export class SceneManager {
  readonly scene = new THREE.Scene();
  world!: WorldRuntime;
  private fog = new THREE.FogExp2(0x000000, 0.02);
  private fogColorTarget = new THREE.Color();
  private fogDensityTarget = 0.02;
  private visibleRooms: RoomRuntime[] = [];
  private currentRoom: RoomRuntime | null = null;
  private environment: THREE.Texture | null = null;

  constructor(
    private level: LevelData,
    private materials: MaterialLibrary,
    private collision: CollisionManager,
  ) {
    this.scene.fog = this.fog;
    this.scene.background = new THREE.Color(0x000000);
  }

  *build(): Generator<string, void> {
    const world = yield* new WorldBuilder(this.level, this.materials, this.collision).build();
    this.world = world;
    this.scene.add(world.root);
  }

  /**
   * Gives metal and glass something to reflect. Real reflections would be costly, so
   * a neutral room is baked once into an environment map, and used very faintly.
   */
  createEnvironment(renderer: THREE.WebGLRenderer): void {
    const generator = new THREE.PMREMGenerator(renderer);
    const room = new RoomEnvironment();
    this.environment = generator.fromScene(room, 0.04).texture;
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.16;
    generator.dispose();
    room.traverse((node) => {
      if (node instanceof THREE.Mesh) node.geometry.dispose();
    });
  }

  room(id: string): RoomRuntime {
    return this.world.rooms.get(id) as RoomRuntime;
  }

  /** The scene's own fog, for putting back after the security feeds turn it off. */
  get fogObject(): THREE.FogExp2 {
    return this.fog;
  }

  get current(): RoomDef | null {
    return this.currentRoom?.def ?? null;
  }

  /** Which room contains a point, preferring the current one. Null if it's in a doorway. */
  findRoomAt(position: THREE.Vector3): string | null {
    const contains = (room: RoomDef) => {
      const [x0, z0, x1, z1] = room.rect;
      return position.x >= x0 && position.x <= x1 && position.z >= z0 && position.z <= z1 && Math.abs(position.y - room.floorY) < 3;
    };
    if (this.currentRoom && contains(this.currentRoom.def)) return this.currentRoom.def.id;
    for (const room of this.level.rooms) {
      if (contains(room)) return room.id;
    }
    return null;
  }

  /** Draws only the given room and what can be seen from it. This is the main performance saving. */
  setRoom(roomId: string, lighting: LightingManager, atmosphere: Atmosphere): void {
    const room = this.room(roomId);
    this.currentRoom = room;
    this.visibleRooms = room.def.visible.map((id) => this.room(id));
    this.applyRoomVisibility([roomId, ...room.def.visible]);
    lighting.setRooms(room, this.visibleRooms);
    atmosphere.setExterior(room.def.openAir === true || this.visibleRooms.some((other) => other.def.openAir));
    this.fogColorTarget.set(room.def.fog.color);
    this.fogDensityTarget = room.def.fog.density;
  }

  applyRoomVisibility(roomIds: string[]): void {
    const visible = new Set(roomIds);
    for (const [id, room] of this.world.rooms) room.group.visible = visible.has(id);
    for (const door of this.world.doors.values()) {
      door.group.visible = visible.has(door.def.a) || visible.has(door.def.b);
    }
  }

  /** Forces every room on, so that all shaders can be compiled during loading. */
  showEverything(): void {
    for (const room of this.world.rooms.values()) room.group.visible = true;
    for (const door of this.world.doors.values()) door.group.visible = true;
  }

  snapFog(): void {
    this.fog.color.copy(this.fogColorTarget);
    this.fog.density = this.fogDensityTarget;
    (this.scene.background as THREE.Color).copy(this.fogColorTarget);
  }

  /** Brings the entire world into line with a session. */
  syncAll(session: GameSession, lighting: LightingManager): void {
    for (const door of this.world.doors.values()) {
      door.setOpen(session.openDoors.has(door.def.id), true);
    }
    this.syncDoorLocks(session);
    this.syncConditions(session, lighting);
    this.syncPickups(session);
  }

  syncDoorLocks(session: GameSession): void {
    for (const door of this.world.doors.values()) {
      const { lock } = door.def;
      const unlocked =
        lock.type === 'none' ||
        session.unlockedDoors.has(door.def.id) ||
        (lock.type === 'flag' && session.flags.has(lock.flag));
      const sealed = door.def.sealedIf ? session.check(door.def.sealedIf) : false;
      door.setLockedLook(!unlocked || sealed);
    }
  }

  /** Shows or hides everything whose state depends on the story, and re-reads the lights. */
  syncConditions(session: GameSession, lighting: LightingManager): void {
    for (const room of this.world.rooms.values()) {
      for (const prop of room.dynamicProps) {
        const shouldShow = session.check(prop.condition);
        if (shouldShow !== prop.visible) {
          prop.visible = shouldShow;
          prop.group.visible = shouldShow;
          this.collision.setEnabled(prop.colliders, shouldShow);
        }
      }
    }
    lighting.refreshPower(this.world.rooms.values());
    lighting.refreshStaticShadows();
  }

  syncPickups(session: GameSession): void {
    for (const room of this.world.rooms.values()) {
      for (const [id, model] of room.pickupModels) model.visible = !session.used.has(id);
    }
  }

  update(dt: number): void {
    const k = 1 - Math.exp(-FOG_RATE * dt);
    this.fog.color.lerp(this.fogColorTarget, k);
    this.fog.density += (this.fogDensityTarget - this.fog.density) * k;
    (this.scene.background as THREE.Color).copy(this.fog.color);

    for (const door of this.world.doors.values()) door.update(dt);
    if (this.currentRoom) this.updateSpinners(this.currentRoom, dt);
  }

  private updateSpinners(room: RoomRuntime, dt: number): void {
    for (const spinner of room.spinners) spinner.mesh.rotation[spinner.axis] += spinner.speed * dt;
  }

  dispose(): void {
    this.environment?.dispose();
    this.world.root.traverse((node) => {
      if (node instanceof THREE.Mesh) node.geometry.dispose();
    });
    this.scene.clear();
  }
}
