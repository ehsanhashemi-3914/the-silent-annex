// Static checks over the level data. These catch whole classes of mistake that would
// otherwise only show up late in a playthrough, such as a door floating in mid-air
// or a key placed behind the door it opens.

import { describe, expect, it } from 'vitest';
import type { Action, Condition, PuzzleId } from '../src/core/Script';
import { ItemDatabase } from '../src/inventory/ItemDatabase';
import { DOCUMENTS } from '../src/progression/content/documents';
import { OBJECTIVES } from '../src/progression/content/objectives';
import type { DoorDef, InteractableDef, LinkDef, RoomDef } from '../src/world/LevelDefinition';
import { LEVEL } from '../src/world/levels';

const rooms = new Map(LEVEL.rooms.map((room) => [room.id, room]));

function roomOf(id: string): RoomDef {
  const room = rooms.get(id);
  if (!room) throw new Error(`Unknown room ${id}`);
  return room;
}

function allInteractables(): InteractableDef[] {
  return LEVEL.rooms.flatMap((room) => room.interactables);
}

function checkConnection(connection: DoorDef | LinkDef, label: string) {
  const a = roomOf(connection.a);
  const b = roomOf(connection.b);
  expect(a.floorY, `${label} joins different floors`).toBe(b.floorY);
  const [ax0, az0, ax1, az1] = a.rect;
  const [bx0, bz0, bx1, bz1] = b.rect;
  const half = connection.width / 2;
  // The gap between the two walls and whether the opening sits within both rooms.
  if (connection.side === 'n' || connection.side === 's') {
    const gap = connection.side === 'n' ? az0 - bz1 : bz0 - az1;
    expect(Math.abs(gap), `${label} wall gap`).toBeLessThanOrEqual(0.31);
    expect(connection.at - half, `${label} left of room A`).toBeGreaterThanOrEqual(ax0);
    expect(connection.at + half, `${label} right of room A`).toBeLessThanOrEqual(ax1);
    expect(connection.at - half, `${label} left of room B`).toBeGreaterThanOrEqual(bx0);
    expect(connection.at + half, `${label} right of room B`).toBeLessThanOrEqual(bx1);
  } else {
    const gap = connection.side === 'e' ? bx0 - ax1 : ax0 - bx1;
    expect(Math.abs(gap), `${label} wall gap`).toBeLessThanOrEqual(0.31);
    expect(connection.at - half, `${label} above room A`).toBeGreaterThanOrEqual(az0);
    expect(connection.at + half, `${label} below room A`).toBeLessThanOrEqual(az1);
    expect(connection.at - half, `${label} above room B`).toBeGreaterThanOrEqual(bz0);
    expect(connection.at + half, `${label} below room B`).toBeLessThanOrEqual(bz1);
  }
}

describe('level geometry', () => {
  it('contains every space the brief requires', () => {
    const required = [
      'mainEntrance',
      'reception',
      'waiting',
      'admin',
      'records',
      'labCorridor',
      'research',
      'observation',
      'electrical',
      'storage',
      'restrictedLab',
      'liftLobby',
      'underCorridor',
      'archive',
      'security',
      'annex',
      'exitTunnel',
    ];
    for (const id of required) expect(rooms.has(id), id).toBe(true);
    expect(LEVEL.doors.some((door) => door.id === 'd_restricted')).toBe(true);
  });

  it('has room ids that are unique', () => {
    expect(rooms.size).toBe(LEVEL.rooms.length);
  });

  it('never lets two rooms on the same floor overlap', () => {
    for (const a of LEVEL.rooms) {
      for (const b of LEVEL.rooms) {
        if (a.id >= b.id || a.floorY !== b.floorY) continue;
        const overlap =
          a.rect[0] < b.rect[2] && b.rect[0] < a.rect[2] && a.rect[1] < b.rect[3] && b.rect[1] < a.rect[3];
        expect(overlap, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  it('places every door in a wall shared by its two rooms', () => {
    for (const door of LEVEL.doors) checkConnection(door, door.id);
  });

  it('places every arch and window in a wall shared by its two rooms', () => {
    for (const link of LEVEL.links) checkConnection(link, `${link.a}-${link.b}`);
  });

  it('only references rooms that exist in visibility lists', () => {
    for (const room of LEVEL.rooms) for (const other of room.visible) expect(rooms.has(other), other).toBe(true);
  });

  it('keeps everything connected through the visibility lists', () => {
    for (const door of LEVEL.doors) {
      expect(roomOf(door.a).visible, `${door.a} should see ${door.b}`).toContain(door.b);
      expect(roomOf(door.b).visible, `${door.b} should see ${door.a}`).toContain(door.a);
    }
  });

  it('starts the player inside the starting room', () => {
    const { room, pos } = LEVEL.start;
    const [x0, z0, x1, z1] = roomOf(room).rect;
    expect(pos[0]).toBeGreaterThan(x0);
    expect(pos[0]).toBeLessThan(x1);
    expect(pos[2]).toBeGreaterThan(z0);
    expect(pos[2]).toBeLessThan(z1);
  });

  it('sends travel interactables to a point inside their target room', () => {
    for (const def of allInteractables()) {
      if (def.kind !== 'travel') continue;
      const [x0, z0, x1, z1] = roomOf(def.to.room).rect;
      expect(def.to.pos[0], def.id).toBeGreaterThan(x0);
      expect(def.to.pos[0], def.id).toBeLessThan(x1);
      expect(def.to.pos[2], def.id).toBeGreaterThan(z0);
      expect(def.to.pos[2], def.id).toBeLessThan(z1);
      expect(def.to.pos[1], def.id).toBe(roomOf(def.to.room).floorY);
    }
  });
});

describe('level references', () => {
  it('uses unique interactable ids', () => {
    const ids = allInteractables().map((def) => def.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only references items, documents and objectives that exist', () => {
    const allActions: Action[] = [
      ...LEVEL.triggers.flatMap((trigger) => trigger.actions),
      ...allInteractables().flatMap((def) => def.actions ?? []),
      ...Object.values(LEVEL.puzzleRewards).flat(),
    ];
    const doors = new Set(LEVEL.doors.map((door) => door.id));
    for (const action of allActions) {
      if ('give' in action) expect(ItemDatabase.has(action.give), action.give).toBe(true);
      if ('take' in action) expect(ItemDatabase.has(action.take), action.take).toBe(true);
      if ('discover' in action) expect(DOCUMENTS[action.discover], action.discover).toBeDefined();
      if ('objective' in action) expect(OBJECTIVES[action.objective], action.objective).toBeDefined();
      if ('unlock' in action) expect(doors.has(action.unlock), action.unlock).toBe(true);
      if ('open' in action) expect(doors.has(action.open), action.open).toBe(true);
      if ('close' in action) expect(doors.has(action.close), action.close).toBe(true);
    }
    for (const def of allInteractables()) {
      if (def.kind === 'pickup') expect(ItemDatabase.has(def.itemId), def.itemId).toBe(true);
      if (def.kind === 'document' || def.kind === 'terminal' || def.kind === 'tape') {
        expect(DOCUMENTS[def.docId], def.docId).toBeDefined();
      }
    }
    for (const door of LEVEL.doors) {
      if (door.lock.type === 'key') expect(ItemDatabase.has(door.lock.itemId), door.lock.itemId).toBe(true);
    }
  });

  it('gives every item a real use or a way to read it', () => {
    const consumed = new Set(LEVEL.doors.flatMap((door) => (door.lock.type === 'key' ? [door.lock.itemId] : [])));
    const special = new Set(['battery', 'fuse_30a', 'lift_key', 'test44_reel', 'ignition_key']);
    for (const item of ItemDatabase.all) {
      expect(consumed.has(item.id) || special.has(item.id) || Boolean(item.docId), item.id).toBe(true);
    }
  });

  it('makes every item obtainable somewhere', () => {
    const placed = new Set(allInteractables().flatMap((def) => (def.kind === 'pickup' ? [def.itemId] : [])));
    for (const item of ItemDatabase.all) expect(placed.has(item.id), item.id).toBe(true);
  });
});

/**
 * A progression solver. It starts from nothing and repeatedly asks: from where the
 * player can reach, what can they do next? Every item, flag or door gained opens up
 * more of the world, until nothing changes. If a required item were locked behind
 * the door it opens, the search would stop short and the test would fail.
 */
describe('no softlocks', () => {
  interface Knowledge {
    reachable: Set<string>;
    items: Set<string>;
    flags: Set<string>;
    solved: Set<PuzzleId>;
    docs: Set<string>;
    usedItems: Set<string>;
    doors: Set<string>;
  }

  /** What the player must have seen or carry before a puzzle can reasonably be solved. */
  const PUZZLE_NEEDS: Record<PuzzleId, (k: Knowledge) => boolean> = {
    records_keypad: (k) => k.docs.has('memo_code') && k.reachable.has('reception'),
    electrical: (k) => k.docs.has('aune_note') && k.items.has('fuse_30a'),
    archive: (k) => k.docs.has('archive_guide') && k.docs.has('test44_log') && k.reachable.has('reception'),
    director_safe: (k) => k.docs.has('director_final') && k.docs.has('test44_log'),
    central: (k) =>
      k.items.has('ignition_key') &&
      k.flags.has('coolant_open') &&
      k.docs.has('procedure_a') &&
      k.docs.has('procedure_b') &&
      k.docs.has('procedure_c'),
  };

  function holds(condition: Condition, k: Knowledge): boolean {
    if ('flag' in condition) {
      // A condition on a flag being false can't be resolved by a monotonic search, so treat it as satisfiable.
      return condition.is === false ? true : k.flags.has(condition.flag);
    }
    if ('item' in condition) return k.items.has(condition.item);
    if ('door' in condition) return k.doors.has(condition.door);
    if ('solved' in condition) return k.solved.has(condition.solved);
    if ('visited' in condition) return k.reachable.has(condition.visited);
    if ('read' in condition) return k.docs.has(condition.read);
    if ('all' in condition) return condition.all.every((inner) => holds(inner, k));
    if ('any' in condition) return condition.any.some((inner) => holds(inner, k));
    return true; // 'not' conditions only hide things once they are done with.
  }

  function apply(actions: Action[], k: Knowledge) {
    for (const action of actions) {
      if ('set' in action && action.value !== false) k.flags.add(action.set);
      if ('give' in action) k.items.add(action.give);
      if ('discover' in action) k.docs.add(action.discover);
      if ('unlock' in action) k.doors.add(action.unlock);
    }
  }

  function doorPassable(door: DoorDef, k: Knowledge, from: string): boolean {
    if (k.doors.has(door.id)) return true;
    switch (door.lock.type) {
      case 'none':
        return true;
      case 'key':
        return k.items.has(door.lock.itemId);
      case 'keypad':
        return k.solved.has(door.lock.puzzleId);
      case 'flag':
        return k.flags.has(door.lock.flag);
      case 'oneway':
        return from === door.lock.from;
    }
  }

  function solve(): Knowledge {
    const k: Knowledge = {
      reachable: new Set([LEVEL.start.room]),
      items: new Set(),
      flags: new Set(),
      solved: new Set(),
      docs: new Set(['signal_log']),
      usedItems: new Set(),
      doors: new Set(),
    };

    let changed = true;
    while (changed) {
      const before = JSON.stringify([...k.reachable, ...k.items, ...k.flags, ...k.solved, ...k.docs, ...k.doors]);

      for (const door of LEVEL.doors) {
        // The entrance seals behind the player but always lets them in first.
        if (k.reachable.has(door.a) && doorPassable(door, k, door.a)) {
          k.reachable.add(door.b);
          k.doors.add(door.id);
        }
        if (k.reachable.has(door.b) && doorPassable(door, k, door.b)) {
          k.reachable.add(door.a);
          k.doors.add(door.id);
        }
      }
      for (const link of LEVEL.links) {
        if (link.kind !== 'arch') continue;
        if (k.reachable.has(link.a)) k.reachable.add(link.b);
        if (k.reachable.has(link.b)) k.reachable.add(link.a);
      }

      for (const room of LEVEL.rooms) {
        if (!k.reachable.has(room.id)) continue;
        for (const def of room.interactables) {
          if (def.visibleIf && !holds(def.visibleIf, k)) continue;
          if (def.requires && !holds(def.requires, k)) continue;
          if (def.kind === 'pickup') k.items.add(def.itemId);
          if (def.kind === 'document' || def.kind === 'terminal' || def.kind === 'tape') k.docs.add(def.docId);
          if (def.kind === 'travel') k.reachable.add(def.to.room);
          if (def.kind === 'puzzle' && PUZZLE_NEEDS[def.puzzleId](k)) {
            k.solved.add(def.puzzleId);
            apply(LEVEL.puzzleRewards[def.puzzleId], k);
          }
          if (def.actions) apply(def.actions, k);
          // Ending choices are recorded as flags here so the test can assert on them.
          for (const action of def.actions ?? []) {
            if ('ending' in action) k.flags.add(`ending_${action.ending}`);
          }
        }
      }

      // Doors with a keypad puzzle can be solved from the door itself.
      for (const door of LEVEL.doors) {
        if (door.lock.type !== 'keypad') continue;
        if (!k.reachable.has(door.a) && !k.reachable.has(door.b)) continue;
        if (PUZZLE_NEEDS[door.lock.puzzleId](k)) {
          k.solved.add(door.lock.puzzleId);
          apply(LEVEL.puzzleRewards[door.lock.puzzleId], k);
        }
      }

      for (const trigger of LEVEL.triggers) {
        const when = trigger.when;
        const fires =
          ('enter' in when && k.reachable.has(when.enter)) ||
          ('zone' in when && k.reachable.has(when.room)) ||
          ('flag' in when && k.flags.has(when.flag)) ||
          ('discover' in when && k.docs.has(when.discover));
        if (fires && (!trigger.requires || holds(trigger.requires, k))) {
          apply(trigger.actions, k);
          for (const action of trigger.actions) {
            if ('ending' in action) k.flags.add(`ending_${action.ending}`);
          }
        }
      }

      changed = before !== JSON.stringify([...k.reachable, ...k.items, ...k.flags, ...k.solved, ...k.docs, ...k.doors]);
    }
    return k;
  }

  const result = solve();

  it('can reach every room', () => {
    for (const room of LEVEL.rooms) expect(result.reachable.has(room.id), room.id).toBe(true);
  });

  it('can obtain every item', () => {
    for (const item of ItemDatabase.all) expect(result.items.has(item.id), item.id).toBe(true);
  });

  it('can solve every puzzle', () => {
    for (const id of Object.keys(LEVEL.puzzleRewards) as PuzzleId[]) expect(result.solved.has(id), id).toBe(true);
  });

  it('can reach both endings', () => {
    expect(result.flags.has('ending_silence')).toBe(true);
    expect(result.flags.has('ending_answer')).toBe(true);
  });

  it('can find every document placed in the world', () => {
    for (const def of allInteractables()) {
      if (def.kind === 'document' || def.kind === 'terminal' || def.kind === 'tape') {
        expect(result.docs.has(def.docId), def.docId).toBe(true);
      }
    }
  });
});
