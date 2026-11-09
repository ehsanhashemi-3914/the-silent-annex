import type * as THREE from 'three';
import type { GameSession } from '../core/GameSession';
import type { InteractionOutcome } from './InteractionLogic';

export type InteractionPose = 'reach' | 'low' | 'high';

/**
 * Anything the player can press E on. The player controller and InteractionSystem only
 * see this interface, so adding a new kind of object never means editing either of them.
 */
export interface Interactable {
  readonly id: string;
  readonly position: THREE.Vector3;
  /** Rooms this can be used from. A door belongs to the rooms on both of its sides. */
  readonly rooms: readonly string[];
  readonly range: number;
  readonly pose: InteractionPose;
  /** Doors are big and solid, so they skip the line-of-sight check that would hit their own collider. */
  readonly skipLineOfSight: boolean;
  isAvailable(session: GameSession): boolean;
  prompt(session: GameSession): string;
  /** True if using it now would be refused, so the prompt can look different. */
  isBlocked(session: GameSession): boolean;
  interact(session: GameSession): InteractionOutcome;
}
