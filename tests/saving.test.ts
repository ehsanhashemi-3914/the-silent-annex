import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/core/GameSession';
import { SAVE_VERSION, validateSave } from '../src/saving/SaveData';
import { SaveManager, type StorageBackend } from '../src/saving/SaveManager';
import { LEVEL, ROOM_IDS } from '../src/world/levels';

class FakeStorage implements StorageBackend {
  data = new Map<string, string>();
  getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  removeItem(key: string) {
    this.data.delete(key);
  }
}

class BrokenStorage implements StorageBackend {
  getItem(): string | null {
    throw new Error('blocked');
  }
  setItem(): void {
    throw new Error('quota');
  }
  removeItem(): void {
    throw new Error('blocked');
  }
}

const session = () => new GameSession(LEVEL, () => 0.5);

describe('SaveManager', () => {
  it('round-trips a real session state', () => {
    const storage = new FakeStorage();
    const manager = new SaveManager(storage, ROOM_IDS);
    const original = session();
    original.inventory.add('fuse_30a');
    original.setFlag('main_power');
    original.unlockDoor('d_admin');
    original.puzzles.electrical.seatFuse();
    expect(manager.save('slot1', original.toSave())).toBe(true);

    const result = manager.load('slot1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const restored = session();
    restored.applySave(result.data);
    expect(restored.inventory.has('fuse_30a')).toBe(true);
    expect(restored.check({ flag: 'main_power' })).toBe(true);
    expect(restored.unlockedDoors.has('d_admin')).toBe(true);
    expect(restored.puzzles.electrical.fuseSeated).toBe(true);
  });

  it('reports an empty slot without crashing', () => {
    const manager = new SaveManager(new FakeStorage(), ROOM_IDS);
    const result = manager.load('slot2');
    expect(result.ok).toBe(false);
    expect(manager.latest()).toBeNull();
  });

  it('falls back to the backup when the main copy is corrupted', () => {
    const storage = new FakeStorage();
    const manager = new SaveManager(storage, ROOM_IDS);
    const game = session();
    game.setFlag('first');
    manager.save('slot1', game.toSave());
    game.setFlag('second');
    manager.save('slot1', game.toSave());
    storage.setItem('silent-annex.save.slot1', '{"truncated": ');

    const result = manager.load('slot1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.recovered).toBe(true);
    expect(result.data.flags).toContain('first');
    expect(result.data.flags).not.toContain('second');
  });

  it('never throws when storage is unavailable', () => {
    const manager = new SaveManager(new BrokenStorage(), ROOM_IDS);
    expect(manager.save('auto', session().toSave())).toBe(false);
    expect(manager.load('auto').ok).toBe(false);
    expect(manager.list()).toEqual([]);
    expect(() => manager.delete('auto')).not.toThrow();
  });

  it('lists saves newest first', () => {
    const manager = new SaveManager(new FakeStorage(), ROOM_IDS);
    const older = { ...session().toSave(), savedAt: 100 };
    const newer = { ...session().toSave(), savedAt: 200 };
    manager.save('slot3', older);
    manager.save('auto', newer);
    expect(manager.list().map((entry) => entry.slot)).toEqual(['auto', 'slot3']);
  });
});

describe('validateSave', () => {
  const valid = () => session().toSave();

  it.each([
    ['null', null],
    ['a string', 'hello'],
    ['an array', []],
    ['no version', { checkpoint: {} }],
    ['a future version', { version: SAVE_VERSION + 1 }],
    ['an unknown old version', { version: 0 }],
  ])('rejects %s', (_name, raw) => {
    expect(validateSave(raw, ROOM_IDS).ok).toBe(false);
  });

  it('rejects a checkpoint in a room that does not exist', () => {
    const save = valid();
    save.checkpoint = { ...save.checkpoint, room: 'narnia' };
    expect(validateSave(save, ROOM_IDS).ok).toBe(false);
  });

  it('rejects a checkpoint with a broken position', () => {
    const save = JSON.parse(JSON.stringify(valid()));
    save.checkpoint.pos = [1, 'two', null];
    expect(validateSave(save, ROOM_IDS).ok).toBe(false);
  });

  it('repairs optional fields instead of failing', () => {
    const save = JSON.parse(JSON.stringify(valid()));
    save.inventory = ['battery', 'fake_item', 42];
    save.battery = 9000;
    save.flags = 'not a list';
    delete save.objective;
    const result = validateSave(save, ROOM_IDS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.inventory[0]).toBe('battery');
    expect(result.data.inventory[1]).toBeNull();
    expect(result.data.inventory[2]).toBeNull();
    expect(result.data.battery).toBe(100);
    expect(result.data.flags).toEqual([]);
    expect(result.data.objective).toBe('arrive');
  });

  it('upgrades a version 1 save', () => {
    const old = {
      version: 1,
      savedAt: 5,
      flags: { main_power: true, off_flag: false },
      checkpoint: { room: 'reception', x: 1, y: 0, z: 12, yaw: 0.5 },
    };
    const result = validateSave(old, ROOM_IDS);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.version).toBe(SAVE_VERSION);
    expect(result.data.flags).toEqual(['main_power']);
    expect(result.data.checkpoint.pos).toEqual([1, 0, 12]);
  });
});
