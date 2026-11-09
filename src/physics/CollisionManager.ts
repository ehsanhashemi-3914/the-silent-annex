import * as THREE from 'three';
import type { ColliderBox } from '../assets/geometry/PropBuilder';
import type { Collider, PhysicsWorld } from './PhysicsWorld';

const tempCenter = new THREE.Vector3();

/** Places colliders in the world and groups the ones that switch on and off together. */
export class CollisionManager {
  constructor(private physics: PhysicsWorld) {}

  addBox(x: number, y: number, z: number, hx: number, hy: number, hz: number, rotationY = 0): Collider {
    return this.physics.addBox({ x, y, z }, { x: hx, y: hy, z: hz }, rotationY);
  }

  /** A box given by its two opposite corners. */
  addBounds(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Collider {
    return this.addBox((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, Math.abs(x1 - x0) / 2, Math.abs(y1 - y0) / 2, Math.abs(z1 - z0) / 2);
  }

  /** Adds a prop's collision boxes after moving them by the prop's position and rotation. */
  addPropColliders(boxes: ColliderBox[], x: number, y: number, z: number, rotationY: number, scale: number): Collider[] {
    const cos = Math.cos(rotationY);
    const sin = Math.sin(rotationY);
    return boxes.map((box) => {
      tempCenter.copy(box.center).multiplyScalar(scale);
      const wx = x + tempCenter.x * cos + tempCenter.z * sin;
      const wz = z - tempCenter.x * sin + tempCenter.z * cos;
      return this.addBox(wx, y + tempCenter.y, wz, box.half.x * scale, box.half.y * scale, box.half.z * scale, rotationY + box.rotationY);
    });
  }

  setEnabled(colliders: Collider[], enabled: boolean): void {
    for (const collider of colliders) collider.setEnabled(enabled);
  }
}
