import type { EndingId, Vec3 } from '../core/Script';
import { ItemDatabase } from '../inventory/ItemDatabase';
import { INVENTORY_CAPACITY } from '../inventory/InventorySystem';

export const SAVE_VERSION = 2;

export interface CheckpointData {
  room: string;
  pos: Vec3;
  yaw: number;
}

export interface SaveData {
  version: number;
  savedAt: number;
  label: string;
  playtime: number;
  checkpoint: CheckpointData;
  flags: string[];
  inventory: (string | null)[];
  storage: string[];
  collected: string[];
  unlockedDoors: string[];
  openDoors: string[];
  documents: string[];
  visited: string[];
  puzzles: Record<string, unknown>;
  objective: string;
  objectivesDone: string[];
  battery: number;
  firedTriggers: string[];
  hushAttempts: Record<string, number>;
  ending: EndingId | null;
}

type RawSave = Record<string, unknown>;

/**
 * One upgrade per old version. Each takes data in version N and returns version N + 1,
 * so an old save simply walks up the chain. Version 1 stored flags as an object and
 * the checkpoint position as separate x, y, z numbers.
 */
const MIGRATIONS: Record<number, (save: RawSave) => RawSave> = {
  1: (save) => {
    const flags = isRecord(save.flags)
      ? Object.keys(save.flags).filter((key) => (save.flags as RawSave)[key] === true)
      : [];
    const old = isRecord(save.checkpoint) ? save.checkpoint : {};
    return {
      ...save,
      version: 2,
      flags,
      checkpoint: { room: old.room, pos: [old.x, old.y, old.z], yaw: old.yaw },
    };
  },
};

function isRecord(value: unknown): value is RawSave {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [];
}

export type ValidationResult = { ok: true; data: SaveData } | { ok: false; error: string };

/**
 * Turns unknown JSON into trustworthy SaveData. Data the game can't run without
 * (version, checkpoint) must be valid or the save is rejected. Optional lists
 * and missing details are repaired instead, so a damaged save still loads when
 * it safely can. Nothing untrusted reaches the rest of the game.
 */
export function validateSave(raw: unknown, knownRooms: ReadonlySet<string>): ValidationResult {
  if (!isRecord(raw)) return { ok: false, error: 'Save is not an object' };

  let save: RawSave = raw;
  if (!isFiniteNumber(save.version)) return { ok: false, error: 'Save has no version' };
  if (save.version > SAVE_VERSION) return { ok: false, error: 'Save is from a newer version of the game' };
  while ((save.version as number) < SAVE_VERSION) {
    const migrate = MIGRATIONS[save.version as number];
    if (!migrate) return { ok: false, error: `No upgrade path from save version ${String(save.version)}` };
    save = migrate(save);
  }

  const checkpoint = save.checkpoint;
  if (!isRecord(checkpoint)) return { ok: false, error: 'Save has no checkpoint' };
  if (typeof checkpoint.room !== 'string' || !knownRooms.has(checkpoint.room)) {
    return { ok: false, error: 'Checkpoint is in an unknown room' };
  }
  const pos = checkpoint.pos;
  if (!Array.isArray(pos) || pos.length !== 3 || !pos.every(isFiniteNumber)) {
    return { ok: false, error: 'Checkpoint position is invalid' };
  }

  const inventory = Array.isArray(save.inventory) ? save.inventory : [];
  const slots = Array.from({ length: INVENTORY_CAPACITY }, (_, i) => {
    const id = inventory[i];
    return typeof id === 'string' && ItemDatabase.has(id) ? id : null;
  });

  const ending = save.ending === 'silence' || save.ending === 'answer' ? save.ending : null;
  const hushAttempts: Record<string, number> = {};
  if (isRecord(save.hushAttempts)) {
    for (const [key, value] of Object.entries(save.hushAttempts)) {
      if (isFiniteNumber(value)) hushAttempts[key] = value;
    }
  }

  return {
    ok: true,
    data: {
      version: SAVE_VERSION,
      savedAt: isFiniteNumber(save.savedAt) ? save.savedAt : 0,
      label: typeof save.label === 'string' ? save.label : 'Unknown location',
      playtime: isFiniteNumber(save.playtime) ? Math.max(0, save.playtime) : 0,
      checkpoint: {
        room: checkpoint.room,
        pos: pos as Vec3,
        yaw: isFiniteNumber(checkpoint.yaw) ? checkpoint.yaw : 0,
      },
      flags: stringList(save.flags),
      inventory: slots,
      storage: stringList(save.storage).filter((id) => ItemDatabase.has(id)),
      collected: stringList(save.collected),
      unlockedDoors: stringList(save.unlockedDoors),
      openDoors: stringList(save.openDoors),
      documents: stringList(save.documents),
      visited: stringList(save.visited),
      puzzles: isRecord(save.puzzles) ? save.puzzles : {},
      objective: typeof save.objective === 'string' ? save.objective : 'arrive',
      objectivesDone: stringList(save.objectivesDone),
      battery: isFiniteNumber(save.battery) ? Math.min(100, Math.max(0, save.battery)) : 100,
      firedTriggers: stringList(save.firedTriggers),
      hushAttempts,
      ending,
    },
  };
}
