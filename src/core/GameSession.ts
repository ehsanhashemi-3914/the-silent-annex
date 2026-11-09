import { InventorySystem } from '../inventory/InventorySystem';
import { ItemDatabase } from '../inventory/ItemDatabase';
import { JournalManager } from '../progression/JournalManager';
import { ObjectiveManager } from '../progression/ObjectiveManager';
import { PuzzleManager, type PuzzleHost } from '../puzzles/PuzzleManager';
import { SAVE_VERSION, type CheckpointData, type SaveData } from '../saving/SaveData';
import { EventDirector } from '../systems/EventDirector';
import { HushSequence } from '../systems/HushSequence';
import { SuspenseDirector } from '../systems/SuspenseDirector';
import type { DoorDef, LevelData, RoomDef } from '../world/LevelDefinition';
import { EventBus } from './EventBus';
import type { GameEvents } from './GameEvents';
import type { Action, Condition, EndingId, PuzzleId, Vec3 } from './Script';

const BATTERY_DRAIN_PER_SECOND = 0.13;
const BATTERY_ITEM_CHARGE = 50;
/** After this many times being caught in one Hush, it gives way so nobody gets stuck. */
const MAX_HUSH_ATTEMPTS = 2;

/**
 * Everything that makes up one playthrough, with no rendering involved. It owns the
 * game state and is the only place that changes it. The real game drives it from
 * player input, and the tests drive it directly.
 */
export class GameSession implements PuzzleHost {
  readonly bus = new EventBus<GameEvents>();
  readonly inventory = new InventorySystem(this.bus);
  readonly objectives = new ObjectiveManager(this.bus);
  readonly journal = new JournalManager(this.bus);
  readonly puzzles = new PuzzleManager(this);
  readonly hush = new HushSequence(this.bus);
  readonly suspense: SuspenseDirector;
  readonly events: EventDirector;

  flags = new Set<string>();
  /** Pickups and single-use interactables that have been consumed. */
  used = new Set<string>();
  unlockedDoors = new Set<string>();
  openDoors = new Set<string>();
  visited = new Set<string>();
  hushAttempts: Record<string, number> = {};

  currentRoom: string;
  playerPos: Vec3;
  playerYaw: number;
  checkpoint: CheckpointData;
  battery = 100;
  playtime = 0;
  ending: EndingId | null = null;

  private rooms = new Map<string, RoomDef>();
  private doors = new Map<string, DoorDef>();

  constructor(
    readonly level: LevelData,
    random: () => number = Math.random,
  ) {
    for (const room of level.rooms) this.rooms.set(room.id, room);
    for (const door of level.doors) this.doors.set(door.id, door);

    const { room, pos, yaw } = level.start;
    this.currentRoom = room;
    this.playerPos = [...pos];
    this.playerYaw = yaw;
    this.checkpoint = { room, pos: [...pos], yaw };

    this.suspense = new SuspenseDirector(this.bus, random);
    this.events = new EventDirector(this, level.triggers, level.rooms);
    this.journal.discover('signal_log');

    // The coolant valve is a physical wheel out in the corridor, but it belongs to Puzzle C.
    this.bus.on('flag:changed', ({ flag, value }) => {
      if (flag === 'coolant_open' && value) this.puzzles.openCoolant();
    });

    this.bus.on('hush:ended', ({ id, outcome }) => {
      if (outcome === 'survived') {
        this.setFlag(`hush_${id}_done`);
        return;
      }
      this.hushAttempts[id] = (this.hushAttempts[id] ?? 0) + 1;
      if (this.hushAttempts[id] >= MAX_HUSH_ATTEMPTS) this.setFlag(`hush_${id}_done`);
    });
  }

  room(id: string = this.currentRoom): RoomDef {
    return this.rooms.get(id) as RoomDef;
  }

  door(id: string): DoorDef | undefined {
    return this.doors.get(id);
  }

  // Conditions and actions

  check(condition: Condition): boolean {
    if ('flag' in condition) return this.flags.has(condition.flag) === (condition.is ?? true);
    if ('item' in condition) return this.inventory.has(condition.item);
    if ('door' in condition) return this.unlockedDoors.has(condition.door);
    if ('solved' in condition) return this.puzzles.isSolved(condition.solved);
    if ('visited' in condition) return this.visited.has(condition.visited);
    if ('read' in condition) return this.journal.has(condition.read);
    if ('all' in condition) return condition.all.every((inner) => this.check(inner));
    if ('any' in condition) return condition.any.some((inner) => this.check(inner));
    return !this.check(condition.not);
  }

  run(actions: Action[]): void {
    for (const action of actions) this.runOne(action);
  }

  private runOne(action: Action): void {
    if ('set' in action) this.setFlag(action.set, action.value ?? true);
    else if ('give' in action) this.inventory.add(action.give);
    else if ('take' in action) this.inventory.remove(action.take);
    else if ('unlock' in action) this.unlockDoor(action.unlock);
    else if ('open' in action) this.openDoor(action.open);
    else if ('close' in action) this.closeDoor(action.close);
    else if ('objective' in action) this.objectives.set(action.objective);
    else if ('say' in action) this.bus.emit('say', { text: action.say, hold: action.hold ?? 0 });
    else if ('toast' in action) this.bus.emit('toast', { text: action.toast });
    else if ('discover' in action) this.journal.discover(action.discover);
    else if ('cue' in action) this.bus.emit('cue', { cue: action.cue, at: action.at });
    else if ('script' in action) this.bus.emit('script', { name: action.script, args: action.args ?? {} });
    else if ('hush' in action) this.hush.start(action.hush);
    else if ('checkpoint' in action) this.setCheckpoint(action.checkpoint);
    else if ('ending' in action) this.finish(action.ending);
  }

  setFlag(flag: string, value = true): void {
    if (this.flags.has(flag) === value) return;
    if (value) this.flags.add(flag);
    else this.flags.delete(flag);
    this.bus.emit('flag:changed', { flag, value });
  }

  // World

  enterRoom(roomId: string): void {
    if (roomId === this.currentRoom && this.visited.has(roomId)) return;
    const previous = this.visited.size === 0 ? null : this.currentRoom;
    const firstVisit = !this.visited.has(roomId);
    this.currentRoom = roomId;
    this.visited.add(roomId);
    this.bus.emit('room:entered', { roomId, previous, firstVisit });
  }

  setPlayerPose(pos: Vec3, yaw: number): void {
    this.playerPos = pos;
    this.playerYaw = yaw;
  }

  unlockDoor(id: string): void {
    if (this.unlockedDoors.has(id)) return;
    this.unlockedDoors.add(id);
    this.bus.emit('door:unlocked', { doorId: id });
  }

  openDoor(id: string): void {
    if (this.openDoors.has(id)) return;
    this.openDoors.add(id);
    this.bus.emit('door:opened', { doorId: id });
  }

  closeDoor(id: string): void {
    if (!this.openDoors.has(id)) return;
    this.openDoors.delete(id);
    this.bus.emit('door:closed', { doorId: id });
  }

  setCheckpoint(id: string): void {
    this.checkpoint = { room: this.currentRoom, pos: [...this.playerPos], yaw: this.playerYaw };
    this.bus.emit('checkpoint', { id });
  }

  finish(ending: EndingId): void {
    if (this.ending) return;
    this.ending = ending;
    this.bus.emit('ending', { ending });
  }

  // Items

  /** Uses an item from the bag. Returns the document to open if it's a readable one. */
  useItem(itemId: string): { docId?: string; used: boolean; text?: string } {
    const item = ItemDatabase.get(itemId);
    if (!item || !this.inventory.has(itemId)) return { used: false };
    if (itemId === 'battery') {
      if (this.battery >= 100) return { used: false, text: 'The torch is already fully charged.' };
      this.battery = Math.min(100, this.battery + BATTERY_ITEM_CHARGE);
      this.inventory.remove(itemId);
      this.bus.emit('item:used', { itemId });
      return { used: true };
    }
    if (item.docId) {
      this.journal.discover(item.docId);
      return { used: true, docId: item.docId };
    }
    return { used: false, text: 'It has to be used on the right thing, out in the building.' };
  }

  updateFlashlight(dt: number, on: boolean): void {
    if (on) this.battery = Math.max(0, this.battery - BATTERY_DRAIN_PER_SECOND * dt);
  }

  // PuzzleHost

  hasItem(itemId: string): boolean {
    return this.inventory.has(itemId);
  }

  takeItem(itemId: string): boolean {
    return this.inventory.remove(itemId);
  }

  puzzleSolved(puzzleId: PuzzleId): void {
    this.bus.emit('puzzle:solved', { puzzleId });
    this.run(this.level.puzzleRewards[puzzleId]);
  }

  puzzleFailed(puzzleId: PuzzleId, reason: string): void {
    this.bus.emit('puzzle:failed', { puzzleId, reason });
  }

  puzzleChanged(puzzleId: PuzzleId): void {
    this.bus.emit('puzzle:changed', { puzzleId });
  }

  // Saving

  toSave(): SaveData {
    const inventory = this.inventory.snapshot();
    return {
      version: SAVE_VERSION,
      savedAt: Date.now(),
      label: this.room(this.checkpoint.room)?.name ?? 'Unknown location',
      playtime: this.playtime,
      checkpoint: this.checkpoint,
      flags: [...this.flags],
      inventory: inventory.slots,
      storage: inventory.storage,
      collected: [...this.used],
      unlockedDoors: [...this.unlockedDoors],
      openDoors: [...this.openDoors],
      documents: [...this.journal.discovered],
      visited: [...this.visited],
      puzzles: this.puzzles.snapshot(),
      objective: this.objectives.currentId,
      objectivesDone: this.objectives.completed,
      battery: this.battery,
      firedTriggers: [...this.events.fired],
      hushAttempts: { ...this.hushAttempts },
      ending: this.ending,
    };
  }

  /** Replaces the whole session state from validated save data. */
  applySave(data: SaveData): void {
    this.hush.cancel();
    this.events.clearPending();
    this.flags = new Set(data.flags);
    this.used = new Set(data.collected);
    this.unlockedDoors = new Set(data.unlockedDoors);
    this.openDoors = new Set(data.openDoors);
    this.visited = new Set(data.visited);
    this.hushAttempts = { ...data.hushAttempts };
    this.inventory.restore({ slots: data.inventory, storage: data.storage });
    this.journal.restore(data.documents);
    this.objectives.restore(data.objective, data.objectivesDone);
    this.puzzles.restore(data.puzzles as Partial<Record<PuzzleId, unknown>>);
    this.events.fired = new Set(data.firedTriggers);
    this.battery = data.battery;
    this.playtime = data.playtime;
    this.ending = data.ending;
    this.checkpoint = data.checkpoint;
    this.currentRoom = data.checkpoint.room;
    this.playerPos = [...data.checkpoint.pos];
    this.playerYaw = data.checkpoint.yaw;
  }
}
