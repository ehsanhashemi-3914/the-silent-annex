import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { ItemDatabase } from './ItemDatabase';

export const INVENTORY_CAPACITY = 8;

export interface InventorySnapshot {
  slots: (string | null)[];
  storage: string[];
}

/**
 * The player's limited carried slots, plus the shared pneumatic-post storage.
 * Storage has no limit, so a full bag can never block a required pickup.
 */
export class InventorySystem {
  private slots: (string | null)[] = new Array(INVENTORY_CAPACITY).fill(null);
  private stored: string[] = [];

  constructor(private bus: EventBus<GameEvents>) {}

  get items(): readonly (string | null)[] {
    return this.slots;
  }

  get storage(): readonly string[] {
    return this.stored;
  }

  get isFull(): boolean {
    return this.slots.every((slot) => slot !== null);
  }

  has(itemId: string): boolean {
    return this.slots.includes(itemId);
  }

  count(itemId: string): number {
    return this.slots.filter((slot) => slot === itemId).length;
  }

  /** Adds an item to the first free slot. Returns false and announces it when full. */
  add(itemId: string): boolean {
    if (!ItemDatabase.has(itemId)) return false;
    const free = this.slots.indexOf(null);
    if (free < 0) {
      this.bus.emit('inventory:full', { itemId });
      return false;
    }
    this.slots[free] = itemId;
    this.bus.emit('item:added', { itemId });
    return true;
  }

  remove(itemId: string): boolean {
    const index = this.slots.indexOf(itemId);
    if (index < 0) return false;
    this.slots[index] = null;
    this.bus.emit('item:removed', { itemId });
    return true;
  }

  /** Sends the item in a carried slot down the pneumatic post. */
  sendToStorage(slotIndex: number): boolean {
    const itemId = this.slots[slotIndex];
    if (!itemId) return false;
    this.slots[slotIndex] = null;
    this.stored.push(itemId);
    this.bus.emit('item:removed', { itemId });
    return true;
  }

  /** Retrieves an item from storage. Fails without side effects if the bag is full. */
  takeFromStorage(storageIndex: number): boolean {
    const itemId = this.stored[storageIndex];
    if (!itemId) return false;
    const free = this.slots.indexOf(null);
    if (free < 0) {
      this.bus.emit('inventory:full', { itemId });
      return false;
    }
    this.stored.splice(storageIndex, 1);
    this.slots[free] = itemId;
    this.bus.emit('item:added', { itemId });
    return true;
  }

  snapshot(): InventorySnapshot {
    return { slots: [...this.slots], storage: [...this.stored] };
  }

  /** Restores saved contents, dropping unknown items and any overflow beyond capacity. */
  restore(snapshot: InventorySnapshot): void {
    const known = (id: string | null) => (id && ItemDatabase.has(id) ? id : null);
    this.slots = Array.from({ length: INVENTORY_CAPACITY }, (_, i) => known(snapshot.slots[i] ?? null));
    this.stored = snapshot.storage.filter((id) => ItemDatabase.has(id));
    // Items that no longer fit go to storage rather than being lost.
    for (const extra of snapshot.slots.slice(INVENTORY_CAPACITY)) {
      if (known(extra)) this.stored.push(extra as string);
    }
  }
}
