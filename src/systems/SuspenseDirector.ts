import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';

export interface SuspenseContext {
  roomId: string;
  wing: 'exterior' | 'reception' | 'research' | 'archive';
  hushActive: boolean;
  /** Current player noise from 0 to 1. Running makes the building react sooner. */
  noise: number;
}

interface AmbientEvent {
  cue: string;
  wings: SuspenseContext['wing'][];
  /** Minimum tension needed before this event can be picked. */
  minTension: number;
  weight: number;
}

const AMBIENT_EVENTS: AmbientEvent[] = [
  { cue: 'distant:pipe', wings: ['reception', 'research', 'archive'], minTension: 0, weight: 3 },
  { cue: 'distant:wind', wings: ['reception', 'exterior'], minTension: 0, weight: 3 },
  { cue: 'distant:settle', wings: ['reception', 'research', 'archive'], minTension: 0, weight: 2 },
  { cue: 'distant:drip', wings: ['archive', 'research'], minTension: 0, weight: 2 },
  { cue: 'distant:door', wings: ['reception', 'research', 'archive'], minTension: 0.25, weight: 2 },
  { cue: 'lights:flicker', wings: ['reception', 'research', 'archive'], minTension: 0.2, weight: 2 },
  { cue: 'distant:steps', wings: ['research', 'archive', 'reception'], minTension: 0.45, weight: 2 },
  { cue: 'radio:whisper', wings: ['reception', 'research', 'archive'], minTension: 0.55, weight: 2 },
  { cue: 'silence:dip', wings: ['research', 'archive'], minTension: 0.7, weight: 1 },
];

export const MIN_EVENT_GAP = 22;
export const MAX_EVENT_GAP = 75;

/**
 * Decides when the building should make itself felt between scripted moments.
 * Tension slowly rises as the player spends time here and falls after each event,
 * which spaces scares out instead of firing them on a fixed timer.
 */
export class SuspenseDirector {
  tension = 0.05;
  private untilNext = 40;
  private recent: string[] = [];

  constructor(
    private bus: EventBus<GameEvents>,
    private random: () => number = Math.random,
  ) {}

  update(dt: number, context: SuspenseContext): void {
    if (context.hushActive) {
      this.untilNext = Math.max(this.untilNext, MIN_EVENT_GAP);
      return;
    }
    // Moving loudly makes things happen sooner, and more tense events become available.
    this.tension = Math.min(1, this.tension + dt * (0.0035 + context.noise * 0.004));
    this.untilNext -= dt * (1 + context.noise * 0.5);
    if (this.untilNext > 0) return;

    const event = this.pick(context);
    if (event) {
      this.bus.emit('cue', { cue: event.cue });
      this.recent.push(event.cue);
      if (this.recent.length > 2) this.recent.shift();
      this.tension = Math.max(0.05, this.tension - event.minTension * 0.35 - 0.04);
    }
    this.untilNext = MIN_EVENT_GAP + this.random() * (MAX_EVENT_GAP - MIN_EVENT_GAP) * (1 - this.tension * 0.5);
  }

  /** Scripted story beats push tension up so ambience escalates with the plot. */
  raise(amount: number): void {
    this.tension = Math.min(1, this.tension + amount);
  }

  private pick(context: SuspenseContext): AmbientEvent | null {
    const options = AMBIENT_EVENTS.filter(
      (event) =>
        event.wings.includes(context.wing) && event.minTension <= this.tension && !this.recent.includes(event.cue),
    );
    if (options.length === 0) return null;
    let roll = this.random() * options.reduce((sum, event) => sum + event.weight, 0);
    for (const event of options) {
      roll -= event.weight;
      if (roll <= 0) return event;
    }
    return options[options.length - 1];
  }
}
