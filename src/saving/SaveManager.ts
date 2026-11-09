import { validateSave, type SaveData } from './SaveData';

export type SaveSlot = 'auto' | 'slot1' | 'slot2' | 'slot3';

export const SAVE_SLOTS: readonly SaveSlot[] = ['auto', 'slot1', 'slot2', 'slot3'];

const KEY_PREFIX = 'silent-annex.save.';

/** The few storage operations we need, so tests can substitute a fake. */
export interface StorageBackend {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

class MemoryStorage implements StorageBackend {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

/**
 * Returns localStorage when it actually works. It can be missing or throw in
 * private windows, or with blocked site data, so we test it with a real write.
 */
export function createStorage(): { storage: StorageBackend; persistent: boolean } {
  try {
    const candidate = globalThis.localStorage;
    const probe = `${KEY_PREFIX}probe`;
    candidate.setItem(probe, '1');
    candidate.removeItem(probe);
    return { storage: candidate, persistent: true };
  } catch {
    return { storage: new MemoryStorage(), persistent: false };
  }
}

export interface SaveSummary {
  slot: SaveSlot;
  label: string;
  savedAt: number;
  playtime: number;
}

export type LoadResult =
  | { ok: true; data: SaveData; recovered: boolean }
  | { ok: false; error: string };

export class SaveManager {
  constructor(
    private storage: StorageBackend,
    private knownRooms: ReadonlySet<string>,
  ) {}

  /** Writes a save and keeps the previous one as a backup. Returns false if storage refuses. */
  save(slot: SaveSlot, data: SaveData): boolean {
    const key = KEY_PREFIX + slot;
    try {
      const previous = this.storage.getItem(key);
      if (previous !== null) this.storage.setItem(`${key}.bak`, previous);
      this.storage.setItem(key, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  /** Loads a slot, falling back to its backup if the main copy is damaged. Never throws. */
  load(slot: SaveSlot): LoadResult {
    const key = KEY_PREFIX + slot;
    const main = this.read(key);
    if (main.ok) return { ok: true, data: main.data, recovered: false };
    const backup = this.read(`${key}.bak`);
    if (backup.ok) return { ok: true, data: backup.data, recovered: true };
    return { ok: false, error: main.error };
  }

  delete(slot: SaveSlot): void {
    const key = KEY_PREFIX + slot;
    try {
      this.storage.removeItem(key);
      this.storage.removeItem(`${key}.bak`);
    } catch {
      // Nothing useful to do if storage is unavailable.
    }
  }

  /** Lists every loadable save, newest first. */
  list(): SaveSummary[] {
    const summaries: SaveSummary[] = [];
    for (const slot of SAVE_SLOTS) {
      const result = this.load(slot);
      if (result.ok) {
        const { label, savedAt, playtime } = result.data;
        summaries.push({ slot, label, savedAt, playtime });
      }
    }
    return summaries.sort((a, b) => b.savedAt - a.savedAt);
  }

  latest(): SaveSummary | null {
    return this.list()[0] ?? null;
  }

  private read(key: string): { ok: true; data: SaveData } | { ok: false; error: string } {
    let text: string | null;
    try {
      text = this.storage.getItem(key);
    } catch {
      return { ok: false, error: 'Storage is unavailable' };
    }
    if (text === null) return { ok: false, error: 'No save in this slot' };
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { ok: false, error: 'Save data is corrupted' };
    }
    return validateSave(parsed, this.knownRooms);
  }
}
