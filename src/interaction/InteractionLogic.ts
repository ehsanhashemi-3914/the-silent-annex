// The rules of what happens when the player uses something. This layer never touches
// the renderer: it changes game state and reports back what the presentation should
// do next, such as opening a document. The tests drive this same code.

import type { GameSession } from '../core/GameSession';
import type { PuzzleId } from '../core/Script';
import { ItemDatabase } from '../inventory/ItemDatabase';
import type { DoorDef, InteractableDef } from '../world/LevelDefinition';

export type InteractionOutcome =
  | { type: 'none' }
  | { type: 'denied'; text: string }
  | { type: 'picked-up'; itemId: string }
  | { type: 'bag-full'; itemId: string }
  | { type: 'document'; docId: string }
  | { type: 'puzzle'; puzzleId: PuzzleId }
  | { type: 'post' }
  | { type: 'recorder' }
  | { type: 'examined'; text: string }
  | { type: 'activated' }
  | { type: 'travel'; def: Extract<InteractableDef, { kind: 'travel' }> }
  | { type: 'door-opened'; doorId: string };

/** Whether an interactable should currently exist for the player at all. */
export function isAvailable(session: GameSession, def: InteractableDef): boolean {
  if (session.used.has(def.id)) return false;
  return def.visibleIf ? session.check(def.visibleIf) : true;
}

export function useInteractable(session: GameSession, def: InteractableDef): InteractionOutcome {
  if (!isAvailable(session, def)) return { type: 'none' };
  if (def.requires && !session.check(def.requires)) {
    return { type: 'denied', text: def.deniedText ?? "It won't do anything." };
  }

  // A refused pickup must leave the world unchanged, so it's handled before anything else.
  if (def.kind === 'pickup') {
    if (!session.inventory.add(def.itemId)) return { type: 'bag-full', itemId: def.itemId };
    session.used.add(def.id);
    session.bus.emit('interactable:used', { id: def.id });
    if (def.actions) session.run(def.actions);
    return { type: 'picked-up', itemId: def.itemId };
  }

  if (def.once) session.used.add(def.id);
  session.bus.emit('interactable:used', { id: def.id });
  if (def.kind === 'document' || def.kind === 'terminal' || def.kind === 'tape') session.journal.discover(def.docId);
  if (def.actions) session.run(def.actions);

  switch (def.kind) {
    case 'document':
    case 'terminal':
    case 'tape':
      return { type: 'document', docId: def.docId };
    case 'puzzle':
      return { type: 'puzzle', puzzleId: def.puzzleId };
    case 'post':
      return { type: 'post' };
    case 'recorder':
      return { type: 'recorder' };
    case 'examine':
      return { type: 'examined', text: def.text };
    case 'travel':
      return { type: 'travel', def };
    case 'switch':
      return { type: 'activated' };
  }
}

export type DoorState = 'open' | 'sealed' | 'unlocked' | 'locked';

/** What the player would find if they tried this door right now, from the given room. */
export function doorState(session: GameSession, door: DoorDef, fromRoom: string): DoorState {
  if (session.openDoors.has(door.id)) return 'open';
  if (door.sealedIf && session.check(door.sealedIf)) return 'sealed';
  if (session.unlockedDoors.has(door.id) || door.lock.type === 'none') return 'unlocked';
  if (door.lock.type === 'flag' && session.check({ flag: door.lock.flag })) return 'unlocked';
  if (door.lock.type === 'oneway' && door.lock.from === fromRoom) return 'unlocked';
  if (door.lock.type === 'key' && session.inventory.has(door.lock.itemId)) return 'unlocked';
  return 'locked';
}

export function doorPrompt(session: GameSession, door: DoorDef, fromRoom: string): string {
  const state = doorState(session, door, fromRoom);
  if (state === 'locked' && door.lock.type === 'keypad' && door.lock.puzzleId !== 'archive') {
    return `${door.name}: enter code`;
  }
  if (state === 'unlocked' && door.lock.type === 'key' && !session.unlockedDoors.has(door.id)) {
    return `Unlock with ${ItemDatabase.get(door.lock.itemId)?.name ?? 'key'}`;
  }
  if (state === 'unlocked' && door.lock.type === 'oneway' && !session.unlockedDoors.has(door.id)) return 'Draw the bolt';
  if (state === 'locked' || state === 'sealed') return `${door.name}: locked`;
  return `Open ${door.name.toLowerCase()}`;
}

export function useDoor(session: GameSession, door: DoorDef, fromRoom: string): InteractionOutcome {
  const state = doorState(session, door, fromRoom);
  if (state === 'open') return { type: 'none' };
  if (state === 'sealed') {
    const text = door.sealedText ?? 'It will not open.';
    session.bus.emit('door:denied', { doorId: door.id, text });
    return { type: 'denied', text };
  }
  if (state === 'locked') {
    if (door.lock.type === 'keypad') {
      const puzzleId = door.lock.puzzleId;
      // An archive-style door is worked from a separate panel beside it.
      if (puzzleId === 'archive') {
        session.bus.emit('door:denied', { doorId: door.id, text: door.lock.text });
        return { type: 'denied', text: door.lock.text };
      }
      return { type: 'puzzle', puzzleId };
    }
    const text = door.lock.type === 'none' ? '' : door.lock.text;
    session.bus.emit('door:denied', { doorId: door.id, text });
    return { type: 'denied', text };
  }

  if (door.lock.type === 'key' && !session.unlockedDoors.has(door.id)) {
    if (door.lock.consume) session.inventory.remove(door.lock.itemId);
    const name = ItemDatabase.get(door.lock.itemId)?.name ?? 'the key';
    session.bus.emit('toast', { text: `Used ${name}` });
  }
  session.unlockDoor(door.id);
  session.openDoor(door.id);
  return { type: 'door-opened', doorId: door.id };
}
