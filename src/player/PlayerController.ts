import * as THREE from 'three';
import type { CharacterBody, PhysicsWorld } from '../physics/PhysicsWorld';

const RADIUS = 0.27;
const STAND_HEIGHT = 1.8;
const CROUCH_HEIGHT = 1.15;

const WALK_SPEED = 1.95;
const RUN_SPEED = 3.9;
const CROUCH_SPEED = 0.95;
const ACCELERATION = 11;
const DECELERATION = 14;
const TURN_RATE = 9;
const GRAVITY = 18;
const BLOCKED_STEPS = 2;
const GROUND_RAY_MARGIN = 0.06;
const DOWN = { x: 0, y: -1, z: 0 };

/** How loud each way of moving is. These feed the Hush, and are what makes crouching matter. */
const NOISE_RUN = 1;
const NOISE_WALK = 0.32;
const NOISE_CROUCH = 0.05;

function capsuleHalf(height: number): number {
  return height / 2 - RADIUS;
}

function shortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export interface MoveIntent {
  /** Strafe and forward, each from -1 to 1. */
  x: number;
  y: number;
  /** The direction "forward" means, normally that of the camera. */
  basisYaw: number;
  run: boolean;
  toggleCrouch: boolean;
}

/**
 * Decides how the player moves. Rapier answers one question, "how far can this capsule
 * travel before it hits something?", and everything else (acceleration, speeds, turning
 * and crouching) happens here.
 */
export class PlayerController {
  /** Where her feet are, at the latest physics step. */
  readonly position = new THREE.Vector3();
  /** The same, one step earlier, so rendering can blend smoothly between steps. */
  private previous = new THREE.Vector3();
  private velocity = new THREE.Vector3();
  private verticalSpeed = 0;
  private character: CharacterBody;
  yaw = 0;
  crouching = false;
  grounded = true;
  noise = 0;
  /** Set during cutscenes, documents and the like, when she shouldn't move at all. */
  frozen = false;

  private tempTranslation = new THREE.Vector3();
  private blockedStepsX = 0;
  private blockedStepsZ = 0;

  constructor(
    private physics: PhysicsWorld,
    start: THREE.Vector3,
    yaw: number,
  ) {
    this.position.copy(start);
    this.previous.copy(start);
    this.yaw = yaw;
    this.character = physics.createCharacter(RADIUS, capsuleHalf(STAND_HEIGHT), {
      x: start.x,
      y: start.y + STAND_HEIGHT / 2,
      z: start.z,
    });
  }

  get collider() {
    return this.character.collider;
  }

  get height(): number {
    return this.crouching ? CROUCH_HEIGHT : STAND_HEIGHT;
  }

  get speed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  private bodyCenter(height: number): { x: number; y: number; z: number } {
    return { x: this.position.x, y: this.position.y + height / 2, z: this.position.z };
  }

  fixedUpdate(dt: number, intent: MoveIntent): void {
    this.previous.copy(this.position);

    if (intent.toggleCrouch) this.setCrouch(!this.crouching);

    // Convert input into a world direction relative to the camera.
    let wishX = 0;
    let wishZ = 0;
    if (!this.frozen) {
      const sin = Math.sin(intent.basisYaw);
      const cos = Math.cos(intent.basisYaw);
      wishX = -sin * intent.y + cos * intent.x;
      wishZ = -cos * intent.y - sin * intent.x;
      const length = Math.hypot(wishX, wishZ);
      if (length > 1) {
        wishX /= length;
        wishZ /= length;
      }
    }

    const moving = wishX !== 0 || wishZ !== 0;
    const backward = intent.y < -0.3 && Math.abs(intent.x) < 0.3;
    const topSpeed = this.crouching ? CROUCH_SPEED : intent.run && !backward ? RUN_SPEED : WALK_SPEED;
    const targetX = wishX * topSpeed;
    const targetZ = wishZ * topSpeed;
    // Speeding up and slowing down differ slightly, which gives her some sense of weight.
    const rate = moving ? ACCELERATION : DECELERATION;
    const blend = 1 - Math.exp(-rate * dt);
    this.velocity.x += (targetX - this.velocity.x) * blend;
    this.velocity.z += (targetZ - this.velocity.z) * blend;

    // Ground detection: a short ray straight down from her middle. While she's standing on
    // something, there's nothing for gravity to do. Pressing her into the floor every step
    // made the physics controller stall now and then, which showed up as a stutter.
    const centerNow = this.bodyCenter(this.height);
    const toGround = this.physics.castRay(centerNow, DOWN, this.height / 2 + GROUND_RAY_MARGIN, this.character.collider);
    this.grounded = toGround !== null;
    this.verticalSpeed = this.grounded ? 0 : this.verticalSpeed - GRAVITY * dt;

    // Ask the physics engine how much of the intended movement is actually possible.
    const desired = {
      x: this.velocity.x * dt,
      y: this.verticalSpeed * dt,
      z: this.velocity.z * dt,
    };
    const { controller, collider, body } = this.character;
    controller.computeColliderMovement(collider, desired);
    const corrected = controller.computedMovement();
    this.position.x += corrected.x;
    this.position.y += corrected.y;
    this.position.z += corrected.z;

    // If a wall stops us, drop that part of the velocity so it doesn't build up. It has to
    // hold for a couple of steps first: the physics can report a single empty step for no
    // visible reason, and reacting to that would make her stutter as she walks.
    const blockedX = Math.abs(corrected.x / dt) < Math.abs(this.velocity.x) * 0.5;
    const blockedZ = Math.abs(corrected.z / dt) < Math.abs(this.velocity.z) * 0.5;
    this.blockedStepsX = blockedX ? this.blockedStepsX + 1 : 0;
    this.blockedStepsZ = blockedZ ? this.blockedStepsZ + 1 : 0;
    if (this.blockedStepsX >= BLOCKED_STEPS) this.velocity.x = corrected.x / dt;
    if (this.blockedStepsZ >= BLOCKED_STEPS) this.velocity.z = corrected.z / dt;

    const center = this.bodyCenter(this.height);
    this.tempTranslation.set(center.x, center.y, center.z);
    body.setNextKinematicTranslation(this.tempTranslation);

    // She turns to face the way she's walking.
    if (moving && this.speed > 0.05) {
      const heading = Math.atan2(-this.velocity.x, -this.velocity.z);
      this.yaw += shortestAngle(this.yaw, heading) * (1 - Math.exp(-TURN_RATE * dt));
    }

    const speed = this.speed;
    const target = speed < 0.12 ? 0 : this.crouching ? NOISE_CROUCH : speed > WALK_SPEED + 0.5 ? NOISE_RUN : NOISE_WALK;
    this.noise += (target - this.noise) * (1 - Math.exp(-8 * dt));
  }

  /** Turns the body to face a direction when the camera moves away while standing still. */
  faceToward(yaw: number, dt: number): void {
    this.yaw += shortestAngle(this.yaw, yaw) * (1 - Math.exp(-5 * dt));
  }

  private setCrouch(crouch: boolean): void {
    if (crouch === this.crouching) return;
    if (!crouch) {
      // Standing up under something low would trap her, so check that it's clear first.
      const fits = this.physics.capsuleFits(this.bodyCenter(STAND_HEIGHT), RADIUS, capsuleHalf(STAND_HEIGHT) - 0.03, this.character.collider);
      if (!fits) return;
    }
    this.crouching = crouch;
    this.physics.setCapsule(this.character, RADIUS, capsuleHalf(this.height));
    // Keep the feet in place, as the body's centre moved.
    const center = this.bodyCenter(this.height);
    this.character.body.setTranslation(center, true);
  }

  /** Moves her instantly, for loading a save, taking the lift or being caught. */
  teleport(position: THREE.Vector3, yaw: number): void {
    this.position.copy(position);
    this.previous.copy(position);
    this.velocity.set(0, 0, 0);
    this.verticalSpeed = 0;
    this.noise = 0;
    this.yaw = yaw;
    this.crouching = false;
    this.physics.setCapsule(this.character, RADIUS, capsuleHalf(STAND_HEIGHT));
    const center = this.bodyCenter(STAND_HEIGHT);
    this.character.body.setTranslation(center, true);
    this.grounded = true;
  }

  /** Position blended between the last two physics steps, for smooth rendering. */
  interpolated(alpha: number, out: THREE.Vector3): THREE.Vector3 {
    return out.lerpVectors(this.previous, this.position, alpha);
  }
}
