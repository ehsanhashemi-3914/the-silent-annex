// A level has dozens of lights, but a forward renderer pays for every light on every
// pixel, and changing the count forces shaders to recompile, which causes visible
// stutter. So we keep a small fixed pool of real lights and, as the player moves, hand
// them to whichever authored lights matter most right now.

import * as THREE from 'three';
import { flashlightCookie } from '../assets/procedural/SurfaceArt';
import type { Condition } from '../core/Script';
import type { FlickerKind, RoomDef } from '../world/LevelDefinition';
import type { LightRuntime, RoomRuntime } from '../world/WorldBuilder';
import type { QualityProfile } from './Renderer';

const REASSIGN_INTERVAL = 0.3;

/** How much of a light's brightness is left at a moment in time, from 0 to 1. */
function flickerAmount(kind: FlickerKind, time: number, seed: number): number {
  switch (kind) {
    case 'none':
      return 1;
    case 'slow': {
      const wave = Math.sin(time * 1.3 + seed) * Math.sin(time * 0.37 + seed * 2.1);
      const dip = Math.sin(time * 3.7 + seed) > 0.985 ? 0.35 : 1;
      return (0.86 + wave * 0.12) * dip;
    }
    case 'buzz':
      return 0.8 + Math.sin(time * 92 + seed) * 0.05 + Math.sin(time * 31 + seed * 3) * 0.07 + (Math.sin(time * 0.9 + seed) > 0.96 ? -0.4 : 0);
    case 'broken': {
      // Mostly on, with sudden stuttering failures, like a dying starter.
      const phase = (time * 0.31 + seed * 0.13) % 1;
      if (phase < 0.72) return 0.92 + Math.sin(time * 70 + seed) * 0.05;
      const stutter = Math.sin(time * 41 + seed) * Math.sin(time * 67 + seed * 1.7);
      return stutter > 0.2 ? 0.75 : stutter > -0.4 ? 0.04 : 0.28;
    }
    case 'pulse':
      return 0.62 + (Math.sin(time * 2.1 + seed) * 0.5 + 0.5) * 0.38;
  }
}

export class LightingManager {
  readonly flashlight: THREE.SpotLight;
  private hemisphere: THREE.HemisphereLight;
  private points: THREE.PointLight[] = [];
  private spots: THREE.SpotLight[] = [];
  private keySpot: THREE.SpotLight | null = null;
  private assignedPoints: (LightRuntime | null)[] = [];
  private assignedSpots: (LightRuntime | null)[] = [];
  private assignedKey: LightRuntime | null = null;
  private candidates: LightRuntime[] = [];
  private currentRoom: RoomDef | null = null;
  private reassignTimer = 0;
  private time = 0;
  private burstTime = 0;
  /** Scales everything authored. A Hush takes this to almost nothing. */
  private master = 1;
  private masterTarget = 1;
  private skyColor = new THREE.Color();
  private groundColor = new THREE.Color();
  private ambientIntensity = 0;
  private restoreTime = 0;
  private feedSavedIntensity = 0;
  private feedSavedSky = new THREE.Color();
  private flashlightSaved = 0;
  private needsKeyShadow = true;
  private torchShadowInterval: number;
  private frameCount = 0;
  /** A faint light near the camera, so that the player's surroundings never go fully black. */
  readonly fill: THREE.PointLight;

  constructor(
    private scene: THREE.Scene,
    profile: QualityProfile,
    private check: (condition: Condition) => boolean,
  ) {
    this.hemisphere = new THREE.HemisphereLight(0xffffff, 0x000000, 0.2);
    scene.add(this.hemisphere);

    for (let i = 0; i < profile.pointLights; i++) {
      const light = new THREE.PointLight(0xffffff, 0, 10, 2);
      scene.add(light);
      this.points.push(light);
    }
    for (let i = 0; i < profile.spotLights; i++) {
      const light = new THREE.SpotLight(0xffffff, 0, 20, 0.6, 0.8, 1.6);
      scene.add(light);
      scene.add(light.target);
      this.spots.push(light);
    }
    if (profile.keyShadow && this.spots.length > 0) {
      this.keySpot = this.spots[0];
      this.keySpot.castShadow = true;
      this.keySpot.shadow.mapSize.setScalar(profile.shadowMapSize);
      this.keySpot.shadow.camera.near = 0.4;
      this.keySpot.shadow.bias = -0.0006;
      this.keySpot.shadow.normalBias = 0.03;
      this.keySpot.shadow.autoUpdate = false;
    }

    // The torch: the one light the player controls, and the only one that follows them.
    this.flashlight = new THREE.SpotLight(0xfff0d8, 0, 26, 0.5, 0.42, 1.65);
    this.flashlight.castShadow = true;
    this.flashlight.shadow.mapSize.setScalar(profile.shadowMapSize);
    this.flashlight.shadow.camera.near = 0.2;
    this.flashlight.shadow.camera.far = 26;
    this.flashlight.shadow.bias = -0.0004;
    this.flashlight.shadow.normalBias = 0.024;
    this.flashlight.map = flashlightCookie();
    this.flashlight.shadow.autoUpdate = false;
    this.torchShadowInterval = profile.torchShadowInterval;
    scene.add(this.flashlight);
    scene.add(this.flashlight.target);

    this.fill = new THREE.PointLight(0x9fb4b8, 1.5, 7, 1.6);
    scene.add(this.fill);
  }

  /** Called on entering a room, with the lights of that room and of the ones visible from it. */
  setRooms(current: RoomRuntime, visible: RoomRuntime[]): void {
    this.currentRoom = current.def;
    this.candidates = [...current.lights];
    for (const room of visible) this.candidates.push(...room.lights);
    this.skyColor.set(current.def.ambient.sky);
    this.groundColor.set(current.def.ambient.ground);
    this.ambientIntensity = current.def.ambient.intensity;
    this.reassignTimer = 0;
  }

  /** Re-reads each light's on/off condition. Call this whenever the state of the world changes. */
  refreshPower(rooms: Iterable<RoomRuntime>): void {
    for (const room of rooms) {
      for (const light of room.lights) light.on = light.def.onIf ? this.check(light.def.onIf) : true;
    }
    this.reassignTimer = 0;
  }

  /** Asks for the static shadow map to be redrawn, because something it depends on has changed. */
  refreshStaticShadows(): void {
    this.needsKeyShadow = true;
    this.reassignTimer = 0;
  }

  /** A short spasm through every light, for scares and power changes. */
  burst(duration: number): void {
    this.burstTime = Math.max(this.burstTime, duration);
  }

  /** The stuttering climb of a building coming back to life. */
  restoreSurge(): void {
    this.restoreTime = 2.2;
  }

  /** Target for all authored lighting, approached smoothly. */
  setMaster(level: number): void {
    this.masterTarget = level;
  }

  update(dt: number, playerPos: THREE.Vector3): void {
    this.time += dt;
    this.frameCount++;
    if (this.flashlight.intensity > 0 && this.frameCount % this.torchShadowInterval === 0) this.flashlight.shadow.needsUpdate = true;
    this.burstTime = Math.max(0, this.burstTime - dt);
    this.restoreTime = Math.max(0, this.restoreTime - dt);
    this.master += (this.masterTarget - this.master) * Math.min(1, dt * 2.4);

    this.reassignTimer -= dt;
    if (this.reassignTimer <= 0) {
      this.reassign(playerPos);
      this.reassignTimer = REASSIGN_INTERVAL;
    }

    this.updateFixtures();
    this.applyPool(this.points, this.assignedPoints);
    this.applyPool(this.spots, this.assignedSpots);

    const k = Math.min(1, dt * 2);
    this.hemisphere.color.lerp(this.skyColor, k);
    this.hemisphere.groundColor.lerp(this.groundColor, k);
    this.hemisphere.intensity += (this.ambientIntensity * (0.25 + 0.75 * this.master) - this.hemisphere.intensity) * k;
  }

  private levelFor(light: LightRuntime): number {
    if (!light.on) return 0;
    let level = flickerAmount(light.def.flicker ?? 'none', this.time, light.seed);
    if (this.burstTime > 0) {
      level *= Math.sin(this.time * 47 + light.seed) * Math.sin(this.time * 29 + light.seed * 2) > 0 ? 0.08 : 0.9;
    }
    if (this.restoreTime > 0) {
      const progress = 1 - this.restoreTime / 2.2;
      const threshold = (light.seed * 0.137) % 1;
      if (progress < threshold) level = 0;
      else if (progress < threshold + 0.2) level *= Math.sin(this.time * 55 + light.seed) > 0 ? 1 : 0.1;
    }
    return Math.max(0, level) * this.master;
  }

  /** Sets the brightness of the glowing fixture meshes, independent of the light pool. */
  private updateFixtures(): void {
    for (const light of this.candidates) {
      light.level = this.levelFor(light);
      const material = light.fixtureMaterial;
      if (material) {
        const glow = light.level * 2.8;
        material.color.copy(light.fixtureColor).multiplyScalar(glow + 0.012);
      }
    }
  }

  /** Bright, flat lighting for the security cameras' infrared look. Call restore afterward. */
  beginFeedLighting(): void {
    this.feedSavedIntensity = this.hemisphere.intensity;
    this.feedSavedSky.copy(this.hemisphere.color);
    this.hemisphere.intensity = 1.1;
    this.hemisphere.color.setHex(0xbfd0c8);
    this.flashlightSaved = this.flashlight.intensity;
    this.flashlight.intensity = 0;
  }

  endFeedLighting(): void {
    this.hemisphere.intensity = this.feedSavedIntensity;
    this.hemisphere.color.copy(this.feedSavedSky);
    this.flashlight.intensity = this.flashlightSaved;
  }

  private reassign(playerPos: THREE.Vector3): void {
    const scored: { light: LightRuntime; score: number }[] = [];
    for (const light of this.candidates) {
      if (!light.on) continue;
      const distance = light.position.distanceTo(playerPos);
      // Lights in the player's own room win against nearby lights behind a wall.
      const home = light.room === this.currentRoom ? 8 : 0;
      scored.push({ light, score: home + (light.def.priority ?? 0) * 1.5 - distance * 0.4 });
    }
    scored.sort((a, b) => b.score - a.score);

    // The shadow-casting spot, when there is one, goes to the best light that asks for shadows.
    const key = this.keySpot ? (scored.find((entry) => entry.light.def.shadow && entry.light.def.kind === 'spot')?.light ?? null) : null;
    // These lights never move and the rooms are static, so the shadow map is drawn once per
    // light rather than every frame. That removes a whole extra pass over the scene.
    if (this.keySpot && key !== this.assignedKey && key) this.needsKeyShadow = true;
    this.assignedKey = key;
    if (this.keySpot && this.needsKeyShadow) {
      this.keySpot.shadow.needsUpdate = true;
      this.needsKeyShadow = false;
    }

    let pointIndex = 0;
    let spotIndex = this.keySpot ? 1 : 0;
    this.assignedPoints.length = this.points.length;
    this.assignedSpots.length = this.spots.length;
    this.assignedPoints.fill(null);
    this.assignedSpots.fill(null);
    if (this.keySpot) this.assignedSpots[0] = key;

    for (const { light } of scored) {
      if (light.def.kind === 'point') {
        if (pointIndex < this.points.length) this.assignedPoints[pointIndex++] = light;
      } else if (light !== key && spotIndex < this.spots.length) {
        this.assignedSpots[spotIndex++] = light;
      }
    }

    for (let i = 0; i < this.points.length; i++) this.configure(this.points[i], this.assignedPoints[i]);
    for (let i = 0; i < this.spots.length; i++) this.configure(this.spots[i], this.assignedSpots[i]);
  }

  private configure(light: THREE.PointLight | THREE.SpotLight, source: LightRuntime | null): void {
    if (!source) {
      light.intensity = 0;
      return;
    }
    light.position.copy(source.position);
    light.color.setHex(source.def.color);
    light.distance = source.def.distance;
    if (light instanceof THREE.SpotLight) {
      light.angle = source.def.angle ?? 0.6;
      light.penumbra = source.def.penumbra ?? 0.8;
      if (source.target) light.target.position.copy(source.target);
      light.target.updateMatrixWorld();
    }
  }

  private applyPool(pool: (THREE.PointLight | THREE.SpotLight)[], assigned: (LightRuntime | null)[]): void {
    for (let i = 0; i < pool.length; i++) {
      const source = assigned[i];
      pool[i].intensity = source ? source.def.intensity * source.level : 0;
    }
  }

  get keyLight(): LightRuntime | null {
    return this.assignedKey;
  }

  dispose(): void {
    this.flashlight.map?.dispose();
    this.flashlight.dispose();
    this.hemisphere.dispose();
    for (const light of this.points) {
      this.scene.remove(light);
      light.dispose();
    }
    for (const light of this.spots) {
      this.scene.remove(light);
      this.scene.remove(light.target);
      light.dispose();
    }
    this.fill.dispose();
    this.scene.remove(this.hemisphere, this.flashlight, this.flashlight.target, this.fill);
  }
}
