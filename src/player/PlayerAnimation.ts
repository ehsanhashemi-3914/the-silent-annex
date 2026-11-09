// Procedural animation: rather than playing back recorded motion, this computes a pose
// every frame from what the character is doing. Feet move in a loop matched to actual
// ground speed, and inverse kinematics works out where the knees have to go.

import * as THREE from 'three';
import type { CharacterRig } from './PlayerCharacter';

export type GesturePose = 'none' | 'reach' | 'low' | 'high' | 'inspect';

export interface AnimationState {
  /** Horizontal ground speed in metres per second. */
  speed: number;
  /** How crouched she is, from 0 to 1. */
  crouch: number;
  /** Pitch of the view in radians, used to aim the torch arm and head. */
  aimPitch: number;
  /** How far the view is turned from the way the body faces, in radians. */
  aimYaw: number;
  /** Whether the torch arm is raised to aim. */
  aiming: boolean;
  gesture: GesturePose;
}

const STAND_STRIDE = 0.26;
const RUN_STRIDE = 0.46;

function approach(current: number, target: number, rate: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

export class PlayerAnimation {
  /** Called on each footfall, so that audio stays locked to what's on screen. */
  onFootstep: ((side: 'left' | 'right') => void) | null = null;

  private phase = 0;
  private blend = 0;
  private crouch = 0;
  private time = 0;
  private gestureAmount = 0;
  private gesture: GesturePose = 'none';
  private lastStepPhase = 0;
  private aimAmount = 0;
  private aimYawSmooth = 0;
  private headYaw = 0;

  constructor(private rig: CharacterRig) {}

  /** Plants one leg. Target coordinates are relative to the hip, in the leg's forward plane. */
  private solveLeg(hip: THREE.Group, knee: THREE.Group, foot: THREE.Group, forward: number, down: number): void {
    const { thighLength: a, shinLength: b } = this.rig;
    const reach = Math.min(a + b - 0.001, Math.max(0.15, Math.hypot(forward, down)));
    // The law of cosines gives both angles of the triangle hip-knee-ankle.
    const cosKnee = (a * a + b * b - reach * reach) / (2 * a * b);
    const kneeBend = Math.PI - Math.acos(Math.min(1, Math.max(-1, cosKnee)));
    const cosHip = (a * a + reach * reach - b * b) / (2 * a * reach);
    const hipOffset = Math.acos(Math.min(1, Math.max(-1, cosHip)));
    const toTarget = Math.atan2(forward, down);
    // The character faces -z, so swinging a leg forward is a positive rotation about x...
    hip.rotation.x = toTarget + hipOffset;
    knee.rotation.x = -kneeBend;
    // ...and the foot counter-rotates, to stay roughly flat on the ground.
    foot.rotation.x = -(hip.rotation.x + knee.rotation.x);
  }

  update(dt: number, state: AnimationState): void {
    const rig = this.rig;
    this.time += dt;
    this.crouch = approach(this.crouch, state.crouch, 9, dt);
    this.aimAmount = approach(this.aimAmount, state.aiming ? 1 : 0, 7, dt);

    if (state.gesture !== 'none') this.gesture = state.gesture;
    this.gestureAmount = approach(this.gestureAmount, state.gesture !== 'none' ? 1 : 0, state.gesture !== 'none' ? 10 : 6, dt);

    const walkBlendTarget = Math.min(1, state.speed / 0.5);
    this.blend = approach(this.blend, walkBlendTarget, 10, dt);
    const runAmount = Math.min(1, Math.max(0, (state.speed - 2) / 1.8));
    const stride = (STAND_STRIDE + (RUN_STRIDE - STAND_STRIDE) * runAmount) * (1 - this.crouch * 0.2);

    // One full cycle covers four stride lengths: a foot travels 2L per stance, over half a cycle.
    if (state.speed > 0.02) this.phase = (this.phase + (state.speed * dt) / (stride * 4)) % 1;

    // Hips
    const bob = Math.cos(this.phase * Math.PI * 4) * (0.022 + runAmount * 0.035) * this.blend;
    const crouchDrop = this.crouch * 0.37;
    const breath = Math.sin(this.time * 1.4) * 0.004;
    const hipY = rig.hipHeight - crouchDrop + bob + breath;
    rig.hips.position.y = hipY;
    rig.hips.rotation.y = Math.sin(this.phase * Math.PI * 2) * 0.1 * this.blend;
    rig.hips.rotation.z = Math.sin(this.phase * Math.PI * 2) * 0.03 * this.blend;

    // Legs
    this.updateLeg(rig.hipL, rig.kneeL, rig.footL, this.phase, stride, hipY);
    this.updateLeg(rig.hipR, rig.kneeR, rig.footR, (this.phase + 0.5) % 1, stride, hipY);
    this.checkFootfall();

    // Upper body: leaning into movement, hunched when crouched, counter-rotating against the hips.
    const lean = -(0.05 + runAmount * 0.16) * this.blend - this.crouch * 0.42;
    rig.spine.rotation.x = lean * 0.6;
    rig.chest.rotation.x = lean * 0.4 + Math.sin(this.time * 1.4) * 0.008;
    const aimYaw = Math.max(-1.3, Math.min(1.3, state.aimYaw));
    this.aimYawSmooth = approach(this.aimYawSmooth, aimYaw, 8, dt);
    rig.spine.rotation.y = -rig.hips.rotation.y * 1.2 + this.aimYawSmooth * 0.2;
    rig.chest.rotation.y = this.aimYawSmooth * 0.2;
    // Crouching, the parka's hem hangs back over her legs, instead of riding up.
    rig.skirt.rotation.x = Math.sin(this.phase * Math.PI * 4) * 0.03 * this.blend - this.crouch * 0.42;
    rig.skirt.scale.y = 1 + this.crouch * 0.3;
    rig.skirt.rotation.z = -rig.hips.rotation.z * 1.6;

    // Head: looks where the view looks, gently weighted.
    const pitchLimit = Math.max(-0.6, Math.min(0.6, state.aimPitch));
    rig.neck.rotation.x = approach(rig.neck.rotation.x, pitchLimit * 0.7 + this.crouch * 0.3, 8, dt);
    this.headYaw = approach(this.headYaw, Math.sin(this.time * 0.3) * 0.05, 4, dt);
    rig.head.rotation.y = this.headYaw + this.aimYawSmooth * 0.5;

    this.updateArms(state, runAmount);

    // The antenna whips with movement, which makes the silhouette feel alive.
    const whip = Math.sin(this.phase * Math.PI * 4 + 1) * 0.07 * this.blend + Math.sin(this.time * 2.2) * 0.006;
    rig.antenna.rotation.x = 0.08 - lean * 0.5 + whip;
    rig.antenna.rotation.z = -0.05 + Math.sin(this.phase * Math.PI * 2) * 0.05 * this.blend;
  }

  private updateLeg(hip: THREE.Group, knee: THREE.Group, foot: THREE.Group, phase: number, stride: number, hipY: number): void {
    // Each foot spends half its cycle planted, sliding backward relative to the hip at the
    // walking speed, and the other half swinging forward through the air.
    const stance = phase < 0.5;
    const t = stance ? phase * 2 : (phase - 0.5) * 2;
    const forward = stance ? stride * (1 - 2 * t) : stride * (2 * t - 1);
    const lift = stance ? 0 : Math.sin(t * Math.PI) * (0.09 + stride * 0.12);
    const groundDistance = hipY + 0.02 - 0.075;
    const down = groundDistance - lift * this.blend;
    this.solveLeg(hip, knee, foot, forward * this.blend, down);
    // A crouched stance splays the knees outward slightly.
    hip.rotation.z = (hip === this.rig.hipL ? -1 : 1) * this.crouch * 0.1;
  }

  private checkFootfall(): void {
    if (this.blend < 0.4) {
      this.lastStepPhase = this.phase;
      return;
    }
    // A foot lands at phases 0 and 0.5.
    const before = this.lastStepPhase;
    const now = this.phase;
    if (before > now) this.onFootstep?.('left');
    else if (before < 0.5 && now >= 0.5) this.onFootstep?.('right');
    this.lastStepPhase = now;
  }

  private updateArms(state: AnimationState, runAmount: number): void {
    const rig = this.rig;
    const swing = Math.sin(this.phase * Math.PI * 2) * this.blend * (0.32 + runAmount * 0.5);
    const rest = 0.1 + runAmount * 0.5;

    // Left arm: natural swing, reaching out during a gesture.
    let leftX = swing + 0.05;
    let leftElbow = -rest * 0.9 - 0.15 - this.crouch * 0.5;
    let leftZ = -0.1;
    const gestureT = this.gestureAmount;
    if (gestureT > 0.001) {
      const reach = this.gesture === 'low' ? 1.1 : this.gesture === 'high' ? 2.2 : 1.55;
      leftX = leftX + (reach - leftX) * gestureT;
      leftElbow = leftElbow + (-0.32 - leftElbow) * gestureT;
      leftZ = leftZ + (0.05 - leftZ) * gestureT;
    }
    rig.shoulderL.rotation.x = leftX;
    rig.shoulderL.rotation.z = leftZ;
    rig.elbowL.rotation.x = -leftElbow;

    // Right arm: holds the torch, aiming along the view when it's lit.
    const aimedX = 1.5 + Math.max(-0.5, Math.min(0.5, state.aimPitch));
    const relaxedX = -swing * 0.7 + 0.1;
    const shoulderX = relaxedX + (aimedX - relaxedX) * this.aimAmount;
    rig.shoulderR.rotation.x = shoulderX - rig.spine.rotation.x - rig.chest.rotation.x;
    rig.shoulderR.rotation.y = this.aimYawSmooth * 0.6 * this.aimAmount;
    rig.shoulderR.rotation.z = 0.08 + this.aimAmount * 0.05;
    rig.elbowR.rotation.x = 0.2 + rest * 0.6 + (0.18 - (0.2 + rest * 0.6)) * this.aimAmount;
  }
}
