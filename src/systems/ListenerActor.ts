// The figure seen around the building. It uses the same character builder as the player,
// with every material swapped for near-black, so its silhouette is exactly hers. The
// player has been looking at the answer all along, from behind.

import * as THREE from 'three';
import { glow } from '../assets/geometry/Architecture';
import { PropBuilder } from '../assets/geometry/PropBuilder';
import type { MaterialLibrary } from '../assets/materials/MaterialLibrary';
import type { Vec3 } from '../core/Script';
import { PlayerAnimation } from '../player/PlayerAnimation';
import { createCharacter, type CharacterRig } from '../player/PlayerCharacter';

const WALK_SPEED = 1.15;
const VANISH_TIME = 0.5;

const tempDir = new THREE.Vector3();

export class ListenerActor {
  private rig: CharacterRig;
  private animation: PlayerAnimation;
  private timeLeft = 0;
  private walkTarget: THREE.Vector3 | null = null;
  private lookAtPlayer = false;
  private pathPoints: THREE.Vector3[] = [];
  private pathLength = 0;
  private pathDuration = 0;
  private holdStill = false;
  private clock = 0;
  private walkSpeedNow = 0;
  /** A real position, kept current so that the audio and Hush systems can measure distance. */
  readonly position = new THREE.Vector3();

  constructor(
    private scene: THREE.Scene,
    materials: MaterialLibrary,
  ) {
    const black = materials.get('listener');
    this.rig = createCharacter(materials, black);
    this.rig.root.visible = false;
    this.animation = new PlayerAnimation(this.rig);

    // The small light the guards reported: a dim glow, held low in the right hand.
    const builder = new PropBuilder(materials);
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), glow(builder, 0xffd7a0, 3));
    spark.position.set(0, -0.2, 0);
    this.rig.handR.add(spark);
    scene.add(this.rig.root);
  }

  get visible(): boolean {
    return this.rig.root.visible;
  }

  /** Stands (or walks) somewhere briefly, then flickers out of existence. */
  appear(at: Vec3, lookAtPlayer: boolean, duration: number, walkTo?: Vec3): void {
    this.rig.root.position.set(at[0], at[1], at[2]);
    this.rig.root.visible = true;
    this.timeLeft = duration;
    this.lookAtPlayer = lookAtPlayer;
    this.pathPoints = [];
    this.walkTarget = walkTo ? new THREE.Vector3(walkTo[0], walkTo[1], walkTo[2]) : null;
    this.position.copy(this.rig.root.position);
  }

  /** Follows a path over a set time, as during a Hush. Progress comes from the state machine. */
  walkPath(path: Vec3[], duration: number): void {
    this.pathPoints = path.map((point) => new THREE.Vector3(point[0], point[1], point[2]));
    this.pathLength = 0;
    for (let i = 1; i < this.pathPoints.length; i++) this.pathLength += this.pathPoints[i - 1].distanceTo(this.pathPoints[i]);
    this.pathDuration = duration;
    this.rig.root.position.copy(this.pathPoints[0]);
    this.rig.root.visible = true;
    this.timeLeft = Infinity;
    this.walkTarget = null;
    this.lookAtPlayer = false;
    this.holdStill = false;
  }

  /** Stops it mid-walk, facing the player. It has heard something. */
  setListening(listening: boolean): void {
    this.holdStill = listening;
    this.lookAtPlayer = listening;
  }

  hide(): void {
    this.rig.root.visible = false;
    this.timeLeft = 0;
    this.pathPoints = [];
    this.walkTarget = null;
    this.holdStill = false;
  }

  /** Lets it fade out from wherever it is, over the vanish time. */
  dismiss(): void {
    if (this.visible) this.timeLeft = Math.min(this.timeLeft, VANISH_TIME);
    this.pathPoints = [];
  }

  update(dt: number, playerPos: THREE.Vector3, pathProgress: number): void {
    if (!this.visible) return;
    this.clock += dt;
    const root = this.rig.root;
    let speed = 0;

    if (this.pathPoints.length > 1 && !this.holdStill) {
      this.placeOnPath(pathProgress, dt);
      speed = this.pathDuration > 0 ? this.pathLength / this.pathDuration : 0;
    } else if (this.walkTarget) {
      tempDir.copy(this.walkTarget).sub(root.position);
      tempDir.y = 0;
      const distance = tempDir.length();
      if (distance > 0.05) {
        tempDir.normalize();
        root.position.addScaledVector(tempDir, Math.min(distance, WALK_SPEED * dt));
        root.rotation.y = Math.atan2(-tempDir.x, -tempDir.z);
        speed = WALK_SPEED;
      }
    }

    if (this.lookAtPlayer) {
      const heading = Math.atan2(-(playerPos.x - root.position.x), -(playerPos.z - root.position.z));
      const delta = Math.atan2(Math.sin(heading - root.rotation.y), Math.cos(heading - root.rotation.y));
      root.rotation.y += delta * (1 - Math.exp(-3 * dt));
    }

    this.walkSpeedNow += (speed - this.walkSpeedNow) * (1 - Math.exp(-6 * dt));
    this.animation.update(dt, { speed: this.walkSpeedNow, crouch: 0, aimPitch: 0, aimYaw: 0, aiming: false, gesture: 'none' });
    this.position.copy(root.position);

    if (this.timeLeft !== Infinity) {
      this.timeLeft -= dt;
      // Rather than fading, it stutters away like a bad signal.
      if (this.timeLeft < VANISH_TIME) root.visible = Math.sin(this.clock * 70) > -0.2 + (VANISH_TIME - this.timeLeft) * 2;
      if (this.timeLeft <= 0) this.hide();
    }
  }

  private placeOnPath(progress: number, dt: number): void {
    let remaining = Math.max(0, Math.min(1, progress)) * this.pathLength;
    const root = this.rig.root;
    for (let i = 1; i < this.pathPoints.length; i++) {
      const from = this.pathPoints[i - 1];
      const to = this.pathPoints[i];
      const length = from.distanceTo(to);
      if (remaining <= length || i === this.pathPoints.length - 1) {
        root.position.lerpVectors(from, to, length > 0 ? Math.min(1, remaining / length) : 0);
        tempDir.copy(to).sub(from);
        const heading = Math.atan2(-tempDir.x, -tempDir.z);
        const delta = Math.atan2(Math.sin(heading - root.rotation.y), Math.cos(heading - root.rotation.y));
        root.rotation.y += delta * (1 - Math.exp(-5 * dt));
        return;
      }
      remaining -= length;
    }
  }

  dispose(): void {
    this.scene.remove(this.rig.root);
    this.rig.root.traverse((node) => {
      if (node instanceof THREE.Mesh) node.geometry.dispose();
    });
  }
}
