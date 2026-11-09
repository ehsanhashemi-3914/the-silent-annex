import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/core/GameEvents';
import { INVENTORY_CAPACITY, InventorySystem } from '../src/inventory/InventorySystem';

function create() {
  const bus = new EventBus<GameEvents>();
  const events: string[] = [];
  bus.on('inventory:full', ({ itemId }) => events.push(`full:${itemId}`));
  return { inventory: new InventorySystem(bus), events };
}

describe('InventorySystem', () => {
  it('adds up to its capacity and then refuses', () => {
    const { inventory, events } = create();
    for (let i = 0; i < INVENTORY_CAPACITY; i++) expect(inventory.add('battery')).toBe(true);
    expect(inventory.isFull).toBe(true);
    expect(inventory.add('fuse_30a')).toBe(false);
    expect(inventory.has('fuse_30a')).toBe(false);
    expect(events).toEqual(['full:fuse_30a']);
  });

  it('rejects items that do not exist', () => {
    const { inventory } = create();
    expect(inventory.add('rocket_launcher')).toBe(false);
  });

  it('frees a slot when an item is removed', () => {
    const { inventory } = create();
    inventory.add('admin_key');
    expect(inventory.remove('admin_key')).toBe(true);
    expect(inventory.remove('admin_key')).toBe(false);
    expect(inventory.items.every((slot) => slot === null)).toBe(true);
  });

  it('moves items to storage and back without losing them', () => {
    const { inventory } = create();
    inventory.add('fuse_30a');
    expect(inventory.sendToStorage(0)).toBe(true);
    expect(inventory.has('fuse_30a')).toBe(false);
    expect(inventory.storage).toEqual(['fuse_30a']);
    expect(inventory.takeFromStorage(0)).toBe(true);
    expect(inventory.has('fuse_30a')).toBe(true);
    expect(inventory.storage).toEqual([]);
  });

  it('leaves storage untouched when the bag is too full to retrieve into', () => {
    const { inventory } = create();
    inventory.add('fuse_30a');
    inventory.sendToStorage(0);
    for (let i = 0; i < INVENTORY_CAPACITY; i++) inventory.add('battery');
    expect(inventory.takeFromStorage(0)).toBe(false);
    expect(inventory.storage).toEqual(['fuse_30a']);
  });

  it('restores a snapshot, dropping unknown items and keeping overflow in storage', () => {
    const { inventory } = create();
    const slots = new Array(INVENTORY_CAPACITY).fill('battery');
    slots[1] = 'not_a_real_item';
    inventory.restore({ slots: [...slots, 'fuse_30a'], storage: ['ghost', 'admin_key'] });
    expect(inventory.items[1]).toBeNull();
    expect(inventory.count('battery')).toBe(INVENTORY_CAPACITY - 1);
    expect(inventory.storage).toEqual(['admin_key', 'fuse_30a']);
  });
});
