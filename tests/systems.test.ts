import { describe, expect, it } from 'vitest';
import { EventBus } from '../src/core/EventBus';
import type { GameEvents } from '../src/core/GameEvents';
import { HUSH_CONFIG, HushSequence } from '../src/systems/HushSequence';
import { SuspenseDirector, type SuspenseContext } from '../src/systems/SuspenseDirector';

const STEP = 1 / 30;

function setup() {
  const bus = new EventBus<GameEvents>();
  const outcomes: string[] = [];
  bus.on('hush:ended', ({ outcome }) => outcomes.push(outcome));
  return { bus, hush: new HushSequence(bus), outcomes };
}

function run(hush: HushSequence, seconds: number, noise: number, distance = 8) {
  for (let t = 0; t < seconds; t += STEP) hush.update(STEP, noise, distance);
}

describe('HushSequence', () => {
  it('ends safely if the player keeps still', () => {
    const { hush, outcomes } = setup();
    hush.start('h1');
    run(hush, HUSH_CONFIG.h1.duration + 8, 0);
    expect(outcomes).toEqual(['survived']);
    expect(hush.active).toBe(false);
  });

  it('survives slow crouched movement', () => {
    const { hush, outcomes } = setup();
    hush.start('h2');
    run(hush, HUSH_CONFIG.h2.duration + 8, 0.05, 5);
    expect(outcomes).toEqual(['survived']);
  });

  it('catches a running player quickly', () => {
    const { hush, outcomes } = setup();
    hush.start('h1');
    run(hush, 2.8, 0); // Nothing can happen during the onset.
    run(hush, 3, 1);
    expect(hush.phase === 'caught' || outcomes[0] === 'caught').toBe(true);
    run(hush, 3, 0);
    expect(outcomes).toEqual(['caught']);
  });

  it('notices walking nearby but calms down if the player stops in time', () => {
    const { hush, outcomes } = setup();
    hush.start('h1');
    run(hush, 2.9, 0);
    while (hush.phase === 'stalking') hush.update(STEP, 0.3, 2);
    expect(hush.phase).toBe('noticed');
    run(hush, 3, 0);
    expect(hush.phase).toBe('stalking');
    run(hush, HUSH_CONFIG.h1.duration + 8, 0);
    expect(outcomes).toEqual(['survived']);
  });

  it('treats a door slam during the walk as a sudden noise', () => {
    const { hush } = setup();
    hush.start('h1');
    hush.addNoise(0.5); // Ignored during the onset.
    expect(hush.attention).toBe(0);
    run(hush, 2.9, 0);
    hush.addNoise(0.5);
    expect(hush.attention).toBe(0.5);
  });

  it('ignores a second start while running', () => {
    const { hush } = setup();
    hush.start('h1');
    hush.start('h2');
    expect(hush.id).toBe('h1');
  });

  it('can be cancelled with no outcome', () => {
    const { hush, outcomes } = setup();
    hush.start('h3');
    hush.cancel();
    expect(hush.active).toBe(false);
    expect(outcomes).toEqual([]);
  });
});

describe('SuspenseDirector', () => {
  const context: SuspenseContext = { roomId: 'reception', wing: 'reception', hushActive: false, noise: 0.2 };

  function seeded() {
    let state = 12345;
    return () => {
      state = (state * 16807) % 2147483647;
      return state / 2147483647;
    };
  }

  function simulate(director: SuspenseDirector, bus: EventBus<GameEvents>, seconds: number, ctx = context) {
    const cues: string[] = [];
    const off = bus.on('cue', ({ cue }) => cues.push(cue));
    for (let t = 0; t < seconds; t += 0.25) director.update(0.25, ctx);
    off();
    return cues;
  }

  it('produces events at a reasonable pace, not constantly', () => {
    const bus = new EventBus<GameEvents>();
    const cues = simulate(new SuspenseDirector(bus, seeded()), bus, 600);
    expect(cues.length).toBeGreaterThan(4);
    expect(cues.length).toBeLessThan(30);
  });

  it('never repeats the same event twice in a row', () => {
    const bus = new EventBus<GameEvents>();
    const cues = simulate(new SuspenseDirector(bus, seeded()), bus, 1800);
    for (let i = 1; i < cues.length; i++) expect(cues[i]).not.toBe(cues[i - 1]);
  });

  it('stays out of the way during a Hush', () => {
    const bus = new EventBus<GameEvents>();
    const cues = simulate(new SuspenseDirector(bus, seeded()), bus, 300, { ...context, hushActive: true });
    expect(cues).toEqual([]);
  });

  it('keeps the frightening events back until tension has built', () => {
    const bus = new EventBus<GameEvents>();
    const director = new SuspenseDirector(bus, seeded());
    const early = simulate(director, bus, 90);
    expect(early).not.toContain('radio:whisper');
    expect(early).not.toContain('silence:dip');
  });
});
