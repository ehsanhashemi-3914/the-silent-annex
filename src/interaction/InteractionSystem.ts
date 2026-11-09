import * as THREE from 'three';
import type { GameSession } from '../core/GameSession';
import type { PhysicsWorld, Collider } from '../physics/PhysicsWorld';
import type { Interactable } from './Interactable';

const SCAN_INTERVAL = 0.08;
const tempDir = new THREE.Vector3();
const tempEye = new THREE.Vector3();

/**
 * Finds what the player is most likely trying to use. Only objects in the current room
 * are considered, and they are scored by how close and how centred they are, so
 * moving your view is enough to choose between two nearby things.
 */
export class InteractionSystem {
  focused: Interactable | null = null;
  private byRoom = new Map<string, Interactable[]>();
  private timer = 0;

  constructor(
    interactables: Interactable[],
    private physics: PhysicsWorld,
    private playerCollider: () => Collider,
  ) {
    for (const interactable of interactables) {
      for (const room of interactable.rooms) {
        const list = this.byRoom.get(room);
        if (list) list.push(interactable);
        else this.byRoom.set(room, [interactable]);
      }
    }
  }

  find(id: string): Interactable | undefined {
    for (const list of this.byRoom.values()) {
      const match = list.find((interactable) => interactable.id === id);
      if (match) return match;
    }
    return undefined;
  }

  clear(): void {
    this.focused = null;
  }

  update(dt: number, session: GameSession, playerPos: THREE.Vector3, viewDirection: THREE.Vector3, eyeHeight: number): void {
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = SCAN_INTERVAL;

    const candidates = this.byRoom.get(session.currentRoom);
    this.focused = null;
    if (!candidates) return;

    tempEye.set(playerPos.x, playerPos.y + eyeHeight, playerPos.z);
    let best: Interactable | null = null;
    let bestScore = -Infinity;
    for (const candidate of candidates) {
      if (!candidate.isAvailable(session)) continue;
      tempDir.copy(candidate.position).sub(tempEye);
      const distance = tempDir.length();
      if (distance > candidate.range) continue;
      tempDir.normalize();
      const facing = tempDir.dot(viewDirection);
      // Requires the object to be broadly ahead, though not exactly centred.
      if (facing < 0.1) continue;
      const score = facing * 1.6 - (distance / candidate.range) * 0.8;
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }

    // Finally make sure we aren't reaching through a wall.
    if (best && !best.skipLineOfSight) {
      tempDir.copy(best.position).sub(tempEye);
      const distance = tempDir.length();
      tempDir.normalize();
      const hit = this.physics.castRay(tempEye, tempDir, distance, this.playerCollider());
      if (hit !== null && hit < distance - 0.45) best = null;
    }
    this.focused = best;
  }
}
