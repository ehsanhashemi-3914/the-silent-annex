import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import type { HushId, Vec3 } from '../core/Script';

export type HushPhase = 'idle' | 'onset' | 'stalking' | 'noticed' | 'caught' | 'passing';

export interface HushConfig {
  id: HushId;
  /** Seconds the Listener walks through before the danger passes. */
  duration: number;
  /** How strongly player noise raises the Listener's attention. */
  sensitivity: number;
  /** Distance in metres beyond which noise barely registers. */
  hearingRange: number;
  /** The Listener's walk. Purely presentational, but stored with the rest of the event. */
  path: Vec3[];
}

export const HUSH_CONFIG: Record<HushId, HushConfig> = {
  h1: {
    id: 'h1',
    duration: 22,
    sensitivity: 1.0,
    hearingRange: 22,
    path: [
      [-16, 0, 6.2],
      [-2, 0, 6.2],
      [7.5, 0, 6.2],
    ],
  },
  h2: {
    id: 'h2',
    duration: 28,
    sensitivity: 1.25,
    hearingRange: 20,
    path: [
      [-17.5, -14, -28],
      [-17.5, -14, -14],
      [-8, -14, -14],
      [-8, -14, -28],
      [2, -14, -28],
      [2, -14, -14],
    ],
  },
  h3: {
    id: 'h3',
    duration: 26,
    sensitivity: 1.4,
    hearingRange: 26,
    path: [
      [-8, 0, 19],
      [-8, 0, 10],
      [7, 0, 10],
      [7, 0, 19],
      [0, 0, 20],
    ],
  },
};

const ONSET_TIME = 2.8;
const PASSING_TIME = 3;
const CAUGHT_TIME = 2.2;
const NOTICE_LEVEL = 0.55;
const CALM_LEVEL = 0.3;
const CATCH_LEVEL = 1;
const ATTENTION_DECAY = 0.22;
/** Below this noise, the player counts as quiet and attention starts to fall. */
const QUIET_NOISE = 0.1;

/**
 * The state machine behind each Hush event. It only knows about noise, distance
 * and time, so it can be tested with plain numbers. The renderer and audio system
 * react to the 'hush:phase' events it emits.
 */
export class HushSequence {
  phase: HushPhase = 'idle';
  attention = 0;
  private config: HushConfig | null = null;
  private timer = 0;
  private walked = 0;

  constructor(private bus: EventBus<GameEvents>) {}

  get active(): boolean {
    return this.phase !== 'idle';
  }

  get id(): HushId | null {
    return this.config?.id ?? null;
  }

  /** How far through the walk the Listener is, from 0 to 1. */
  get progress(): number {
    return this.config ? Math.min(1, this.walked / this.config.duration) : 0;
  }

  get path(): Vec3[] {
    return this.config?.path ?? [];
  }

  start(id: HushId): void {
    if (this.active) return;
    this.config = HUSH_CONFIG[id];
    this.attention = 0;
    this.timer = 0;
    this.walked = 0;
    this.setPhase('onset');
  }

  /** A sudden noise such as a door or switch used during the Hush. */
  addNoise(amount: number): void {
    if (this.phase === 'stalking' || this.phase === 'noticed') {
      this.attention = Math.min(CATCH_LEVEL, this.attention + amount);
    }
  }

  update(dt: number, noise: number, distanceToListener: number): void {
    if (!this.config || this.phase === 'idle') return;
    this.timer += dt;

    switch (this.phase) {
      case 'onset':
        if (this.timer >= ONSET_TIME) this.setPhase('stalking');
        break;
      case 'stalking':
        this.walked += dt;
        this.updateAttention(dt, noise, distanceToListener);
        if (this.attention >= CATCH_LEVEL) this.setPhase('caught');
        else if (this.attention >= NOTICE_LEVEL) this.setPhase('noticed');
        else if (this.walked >= this.config.duration) this.setPhase('passing');
        break;
      case 'noticed':
        // The Listener stops walking here, so the timer doesn't count down while it listens.
        this.updateAttention(dt, noise, distanceToListener);
        if (this.attention >= CATCH_LEVEL) this.setPhase('caught');
        else if (this.attention <= CALM_LEVEL) this.setPhase('stalking');
        break;
      case 'caught':
        if (this.timer >= CAUGHT_TIME) this.finish('caught');
        break;
      case 'passing':
        if (this.timer >= PASSING_TIME) this.finish('survived');
        break;
    }
  }

  /** Stops a running Hush without an outcome, used when loading a save. */
  cancel(): void {
    this.config = null;
    this.phase = 'idle';
    this.attention = 0;
  }

  private updateAttention(dt: number, noise: number, distance: number): void {
    const config = this.config as HushConfig;
    if (noise < QUIET_NOISE) {
      this.attention = Math.max(0, this.attention - ATTENTION_DECAY * dt);
      return;
    }
    const proximity = Math.min(1, Math.max(0.15, 1 - distance / config.hearingRange));
    this.attention = Math.min(CATCH_LEVEL, this.attention + noise * config.sensitivity * proximity * dt);
  }

  private setPhase(phase: HushPhase): void {
    const previous = this.phase;
    this.phase = phase;
    this.timer = 0;
    this.bus.emit('hush:phase', { id: (this.config as HushConfig).id, phase, previous });
  }

  private finish(outcome: 'survived' | 'caught'): void {
    const id = (this.config as HushConfig).id;
    this.setPhase('idle');
    this.config = null;
    this.attention = 0;
    this.bus.emit('hush:ended', { id, outcome });
  }
}
