import * as THREE from 'three';
import type { Collider, PhysicsWorld } from '../physics/PhysicsWorld';
import type { CameraZoneDef } from '../world/LevelDefinition';

const SHOULDER_HEIGHT = 1.6;
const CROUCH_DROP = 0.5;
const SHOULDER_OFFSET = 0.62;
const BOOM_LENGTH = 2.45;
const MIN_PITCH = -1.05;
const MAX_PITCH = 1.05;
const CAMERA_RADIUS = 0.17;
const FOLLOW_RATE = 14;
const BASE_SENSITIVITY = 0.0023;

const up = new THREE.Vector3(0, 1, 0);

export class CameraController {
  readonly camera: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = -0.08;
  sensitivity = 1;
  invertY = false;
  baseFov = 62;

  private pivot = new THREE.Vector3();
  private shoulder = new THREE.Vector3();
  private forward = new THREE.Vector3();
  private right = new THREE.Vector3();
  private desired = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private smoothPos = new THREE.Vector3();
  private crouchSmooth = 0;
  private boomSmooth = BOOM_LENGTH;
  private shake = 0;
  private time = 0;

  private zone: CameraZoneDef | null = null;
  private zoneBlend = 0;
  private zoneBlendRate = 1;
  private zonePos = new THREE.Vector3();
  private lookSmooth = new THREE.Vector3();
  /** A cinematic focus overrides everything, as when zooming in on the monitors. */
  private focusPos: THREE.Vector3 | null = null;
  private focusLook: THREE.Vector3 | null = null;
  private focusBlend = 0;
  private tempPos = new THREE.Vector3();
  private tempLook = new THREE.Vector3();
  private tempDir = new THREE.Vector3();

  constructor(
    aspect: number,
    private physics: PhysicsWorld,
    private exclude: () => Collider | undefined,
  ) {
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.06, 240);
  }

  applyLook(dx: number, dy: number): void {
    const scale = BASE_SENSITIVITY * this.sensitivity;
    this.yaw -= dx * scale;
    this.pitch += (this.invertY ? dy : -dy) * scale;
    this.pitch = Math.max(MIN_PITCH, Math.min(MAX_PITCH, this.pitch));
  }

  /** Puts the camera straight behind the player, for spawning or teleporting. */
  snapBehind(yaw: number, position: THREE.Vector3): void {
    this.yaw = yaw;
    this.pitch = -0.08;
    this.zone = null;
    this.zoneBlend = 0;
    this.computeOrbit(position, 0);
    this.smoothPos.copy(this.desired);
    this.camera.position.copy(this.desired);
    this.lookSmooth.copy(this.lookTarget);
    this.camera.lookAt(this.lookTarget);
  }

  setZone(zone: CameraZoneDef | null): void {
    if (zone === this.zone) return;
    if (zone) {
      this.zonePos.set(zone.pos[0], zone.pos[1], zone.pos[2]);
      this.zoneBlendRate = 1 / (zone.blend ?? 1.5);
    }
    this.zone = zone;
  }

  get inZone(): boolean {
    return this.zone !== null;
  }

  /** Which way the camera is really looking across the ground, whether it's in a zone or not. */
  get viewYaw(): number {
    this.camera.getWorldDirection(this.tempDir);
    return Math.atan2(-this.tempDir.x, -this.tempDir.z);
  }

  /** The direction the torch should point when the camera is orbiting behind her. */
  aimDirection(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.forward);
  }

  addShake(amount: number): void {
    this.shake = Math.min(1, this.shake + amount);
  }

  /** Moves the view to a fixed spot for a scripted moment. Passing null hands control back. */
  setFocus(position: THREE.Vector3 | null, look: THREE.Vector3 | null): void {
    this.focusPos = position;
    this.focusLook = look;
  }

  private computeOrbit(playerPos: THREE.Vector3, crouch: number): void {
    const height = SHOULDER_HEIGHT - crouch * CROUCH_DROP;
    this.pivot.set(playerPos.x, playerPos.y + height, playerPos.z);

    const cosPitch = Math.cos(this.pitch);
    this.forward.set(-Math.sin(this.yaw) * cosPitch, Math.sin(this.pitch), -Math.cos(this.yaw) * cosPitch).normalize();
    this.right.crossVectors(this.forward, up).normalize();

    // First reach sideways from the head to the shoulder, without passing through a wall...
    const exclude = this.exclude();
    const sideReach = this.physics.castSphere(this.pivot, this.right, CAMERA_RADIUS, SHOULDER_OFFSET, exclude);
    this.shoulder.copy(this.pivot).addScaledVector(this.right, Math.max(0, sideReach - 0.02));

    // ...then back along the boom from that shoulder.
    this.tempDir.copy(this.forward).negate();
    const clear = this.physics.castSphere(this.shoulder, this.tempDir, CAMERA_RADIUS, BOOM_LENGTH, exclude);
    // Pull in instantly when a wall appears, but ease back out, so it never pops.
    if (clear < this.boomSmooth) this.boomSmooth = clear;
    else this.boomSmooth += (clear - this.boomSmooth) * 0.08;
    this.desired.copy(this.shoulder).addScaledVector(this.tempDir, Math.max(0.1, this.boomSmooth - 0.04));
    this.lookTarget.copy(this.shoulder).addScaledVector(this.forward, 12);
  }

  update(dt: number, playerPos: THREE.Vector3, crouch: number): void {
    this.time += dt;
    this.crouchSmooth += (crouch - this.crouchSmooth) * (1 - Math.exp(-8 * dt));
    this.computeOrbit(playerPos, this.crouchSmooth);

    const follow = 1 - Math.exp(-FOLLOW_RATE * dt);
    this.smoothPos.lerp(this.desired, follow);

    // Blend smoothly between the shoulder view and a composed zone view.
    const zoneTarget = this.zone ? 1 : 0;
    this.zoneBlend += Math.sign(zoneTarget - this.zoneBlend) * Math.min(Math.abs(zoneTarget - this.zoneBlend), dt * this.zoneBlendRate);
    const t = this.zoneBlend * this.zoneBlend * (3 - 2 * this.zoneBlend);

    this.tempPos.copy(this.smoothPos);
    this.tempLook.copy(this.lookTarget);
    let fov = this.baseFov;
    if (t > 0) {
      this.tempPos.lerp(this.zonePos, t);
      // A zone view frames her, with a soft lag so that it feels hand-operated.
      this.tempDir.set(playerPos.x, playerPos.y + 1.15 - this.crouchSmooth * 0.4, playerPos.z);
      this.tempLook.lerp(this.tempDir, t);
      if (this.zone?.fov) fov += (this.zone.fov - fov) * t;
    }

    const focusTarget = this.focusPos ? 1 : 0;
    this.focusBlend += (focusTarget - this.focusBlend) * (1 - Math.exp(-2.6 * dt));
    if (this.focusPos && this.focusLook) {
      this.tempPos.lerp(this.focusPos, this.focusBlend);
      this.tempLook.lerp(this.focusLook, this.focusBlend);
    }

    this.camera.position.copy(this.tempPos);
    this.lookSmooth.lerp(this.tempLook, 1 - Math.exp(-(t > 0 ? 5 : 40) * dt));
    this.camera.lookAt(this.lookSmooth);

    // Faint handheld motion, and a stronger kick when something happens.
    this.shake = Math.max(0, this.shake - dt * 1.4);
    const sway = 0.0016 + this.shake * 0.02;
    this.camera.rotation.z += Math.sin(this.time * 0.73) * sway * 0.7 + Math.sin(this.time * 17) * this.shake * 0.006;
    this.camera.rotation.x += Math.sin(this.time * 0.91 + 1.3) * sway * 0.5;

    if (Math.abs(this.camera.fov - fov) > 0.01) {
      this.camera.fov += (fov - this.camera.fov) * (1 - Math.exp(-6 * dt));
      this.camera.updateProjectionMatrix();
    }
  }

  /** How close the camera has come to her head, which decides when to hide the character. */
  distanceToHead(playerPos: THREE.Vector3): number {
    this.tempDir.set(playerPos.x, playerPos.y + 1.5, playerPos.z);
    return this.camera.position.distanceTo(this.tempDir);
  }
}
