// The two kinds of world object behind the Interactable interface: anything described by
// an InteractableDef, and doors. Both hand the actual rules over to InteractionLogic.

import * as THREE from 'three';
import type { GameSession } from '../core/GameSession';
import type { Interactable, InteractionPose } from '../interaction/Interactable';
import {
  doorPrompt,
  doorState,
  isAvailable,
  useDoor,
  useInteractable,
  type InteractionOutcome,
} from '../interaction/InteractionLogic';
import type { DoorRuntime } from './Door';
import type { InteractableDef, RoomDef } from './LevelDefinition';

const DEFAULT_RANGE = 1.9;
const DOOR_RANGE = 2.3;

export class DefInteractable implements Interactable {
  readonly id: string;
  readonly position: THREE.Vector3;
  readonly rooms: readonly string[];
  readonly range: number;
  readonly pose: InteractionPose;
  readonly skipLineOfSight = false;

  constructor(
    readonly def: InteractableDef,
    room: RoomDef,
  ) {
    this.id = def.id;
    this.position = new THREE.Vector3(def.pos[0], def.pos[1] + room.floorY, def.pos[2]);
    this.rooms = [room.id];
    this.range = def.range ?? DEFAULT_RANGE;
    this.pose = def.pose ?? 'reach';
  }

  isAvailable(session: GameSession): boolean {
    return isAvailable(session, this.def);
  }

  prompt(): string {
    return this.def.prompt;
  }

  isBlocked(session: GameSession): boolean {
    return this.def.requires ? !session.check(this.def.requires) : false;
  }

  interact(session: GameSession): InteractionOutcome {
    return useInteractable(session, this.def);
  }
}

export class DoorInteractable implements Interactable {
  readonly id: string;
  readonly position: THREE.Vector3;
  readonly rooms: readonly string[];
  readonly range = DOOR_RANGE;
  readonly pose: InteractionPose = 'reach';
  readonly skipLineOfSight = true;

  constructor(readonly door: DoorRuntime) {
    this.id = door.def.id;
    this.position = door.center;
    this.rooms = [door.def.a, door.def.b];
  }

  isAvailable(session: GameSession): boolean {
    return !session.openDoors.has(this.id);
  }

  prompt(session: GameSession): string {
    return doorPrompt(session, this.door.def, session.currentRoom);
  }

  isBlocked(session: GameSession): boolean {
    const state = doorState(session, this.door.def, session.currentRoom);
    return state === 'locked' || state === 'sealed';
  }

  interact(session: GameSession): InteractionOutcome {
    return useDoor(session, this.door.def, session.currentRoom);
  }
}
