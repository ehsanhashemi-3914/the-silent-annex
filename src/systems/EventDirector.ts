import type { GameSession } from '../core/GameSession';
import type { Vec3 } from '../core/Script';
import type { RoomDef, TriggerDef, TriggerWhen } from '../world/LevelDefinition';

interface Pending {
  trigger: TriggerDef;
  remaining: number;
}

/**
 * Runs the level's triggers: "when X happens, and this condition holds, do Y".
 * It watches game events so nothing has to poll for story beats, apart from the
 * few zone triggers, which genuinely depend on where the player is standing.
 */
export class EventDirector {
  /** Triggers that have fired. Kept in the save so scares don't replay after loading. */
  fired = new Set<string>();
  private pending: Pending[] = [];
  private unsubscribers: (() => void)[] = [];
  private zoneTriggers: TriggerDef[];
  private byRoom = new Map<string, RoomDef>();

  constructor(
    private session: GameSession,
    private triggers: TriggerDef[],
    rooms: RoomDef[],
  ) {
    this.zoneTriggers = triggers.filter((trigger) => 'zone' in trigger.when);
    for (const room of rooms) this.byRoom.set(room.id, room);

    const bus = session.bus;
    this.unsubscribers = [
      bus.on('room:entered', ({ roomId }) => this.consider((when) => 'enter' in when && when.enter === roomId)),
      bus.on('flag:changed', ({ flag, value }) => {
        if (value) this.consider((when) => 'flag' in when && when.flag === flag);
      }),
      bus.on('item:added', ({ itemId }) => this.consider((when) => 'item' in when && when.item === itemId)),
      bus.on('puzzle:solved', ({ puzzleId }) => this.consider((when) => 'solved' in when && when.solved === puzzleId)),
      bus.on('document:discovered', ({ docId }) => this.consider((when) => 'discover' in when && when.discover === docId)),
      bus.on('interactable:used', ({ id }) => this.consider((when) => 'used' in when && when.used === id)),
    ];
  }

  update(dt: number, playerPos: Vec3, roomId: string): void {
    for (const trigger of this.zoneTriggers) {
      const when = trigger.when as Extract<TriggerWhen, { zone: unknown }>;
      if (when.room !== roomId) continue;
      const [x0, z0, x1, z1] = when.zone;
      if (playerPos[0] < x0 || playerPos[0] > x1 || playerPos[2] < z0 || playerPos[2] > z1) continue;
      this.tryFire(trigger);
    }
    // Iterate backwards so finished entries can be removed in place.
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const entry = this.pending[i];
      entry.remaining -= dt;
      if (entry.remaining <= 0) {
        this.pending.splice(i, 1);
        this.session.run(entry.trigger.actions);
      }
    }
  }

  /** Forgets queued actions, used when loading a save or restarting after being caught. */
  clearPending(): void {
    this.pending = [];
  }

  dispose(): void {
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
  }

  private consider(match: (when: TriggerWhen) => boolean): void {
    for (const trigger of this.triggers) {
      if (match(trigger.when)) this.tryFire(trigger);
    }
  }

  private tryFire(trigger: TriggerDef): void {
    if (!trigger.repeat && this.fired.has(trigger.id)) return;
    if (trigger.requires && !this.session.check(trigger.requires)) return;
    if (this.pending.some((entry) => entry.trigger === trigger)) return;
    this.fired.add(trigger.id);
    if (trigger.delay) this.pending.push({ trigger, remaining: trigger.delay });
    else this.session.run(trigger.actions);
  }
}
