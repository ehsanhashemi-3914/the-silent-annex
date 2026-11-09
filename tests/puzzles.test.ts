import { describe, expect, it } from 'vitest';
import { ArchivePuzzle } from '../src/puzzles/ArchivePuzzle';
import { CentralSystemPuzzle } from '../src/puzzles/CentralSystemPuzzle';
import { ElectricalPuzzle } from '../src/puzzles/ElectricalPuzzle';
import { KeypadPuzzle } from '../src/puzzles/KeypadPuzzle';

describe('ElectricalPuzzle', () => {
  it('does nothing without the fuse', () => {
    const puzzle = new ElectricalPuzzle();
    expect(puzzle.energise()).toBe('no-fuse');
    expect(puzzle.solved).toBe(false);
    expect(puzzle.trips).toBe(0);
  });

  it('starts in a state where every rule is broken', () => {
    const puzzle = new ElectricalPuzzle();
    puzzle.seatFuse();
    expect(puzzle.energise()).toBe('short');
  });

  it('reports each wrong configuration with its own fault', () => {
    const puzzle = new ElectricalPuzzle();
    puzzle.seatFuse();
    puzzle.toggle('west'); // West open, reserve still closed, main open.
    expect(puzzle.energise()).toBe('no-feed');
    puzzle.toggle('main'); // Main and reserve are now both closed.
    expect(puzzle.energise()).toBe('backfeed');
    expect(puzzle.breakers.main).toBe(false); // The fault threw main open.
    puzzle.toggle('reserve');
    puzzle.toggle('main');
    expect(puzzle.energise()).toBe('no-load');
    puzzle.toggle('east');
    expect(puzzle.energise()).toBe('solved');
    expect(puzzle.solved).toBe(true);
  });

  it('has exactly one solution out of all sixteen breaker settings', () => {
    let solutions = 0;
    for (let bits = 0; bits < 16; bits++) {
      const puzzle = new ElectricalPuzzle();
      puzzle.seatFuse();
      puzzle.breakers = {
        main: Boolean(bits & 1),
        west: Boolean(bits & 2),
        east: Boolean(bits & 4),
        reserve: Boolean(bits & 8),
      };
      if (puzzle.energise() === 'solved') solutions++;
    }
    expect(solutions).toBe(1);
  });

  it('restores from a snapshot and tolerates garbage', () => {
    const puzzle = new ElectricalPuzzle();
    puzzle.seatFuse();
    puzzle.toggle('east');
    const restored = new ElectricalPuzzle();
    restored.restore(puzzle.snapshot());
    expect(restored.fuseSeated).toBe(true);
    expect(restored.breakers.east).toBe(true);
    const fresh = new ElectricalPuzzle();
    fresh.restore('nonsense');
    expect(fresh.solved).toBe(false);
  });
});

describe('ArchivePuzzle', () => {
  function dialIn(puzzle: ArchivePuzzle, values: number[]) {
    values.forEach((value, i) => {
      for (let step = 0; step < value; step++) puzzle.rotate(i, 1);
    });
  }

  it('wraps dials in both directions', () => {
    const puzzle = new ArchivePuzzle();
    puzzle.rotate(0, -1);
    expect(puzzle.label(0)).toBe('S');
    puzzle.rotate(1, -1);
    expect(puzzle.label(1)).toBe('9');
  });

  it('accepts G / 44 / 0317 and nothing else', () => {
    const puzzle = new ArchivePuzzle();
    expect(puzzle.pull()).toBe(false);
    expect(puzzle.fails).toBe(1);
    dialIn(puzzle, ArchivePuzzle.SOLUTION);
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => puzzle.label(i)).join('')).toBe('G440317');
    expect(puzzle.pull()).toBe(true);
    expect(puzzle.solved).toBe(true);
  });

  it('rejects out-of-range saved dial values', () => {
    const puzzle = new ArchivePuzzle();
    puzzle.restore({ dials: [99, -1, 3.5, 0, 0, 0, 0], solved: false, fails: 2 });
    expect(puzzle.dials).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(puzzle.fails).toBe(2);
  });
});

describe('CentralSystemPuzzle', () => {
  it('cannot start without the ignition key, and that is not a fault', () => {
    const puzzle = new CentralSystemPuzzle();
    expect(puzzle.startGenerator()).toBe('no-key');
    expect(puzzle.faults).toBe(0);
  });

  it('overheats if started before the coolant is open', () => {
    const puzzle = new CentralSystemPuzzle();
    puzzle.insertKey();
    expect(puzzle.startGenerator()).toBe('fault-overtemp');
    expect(puzzle.generator).toBe(false);
    expect(puzzle.faults).toBe(1);
  });

  it('starts the fans along with the generator, which blocks the dampers', () => {
    const puzzle = new CentralSystemPuzzle();
    puzzle.insertKey();
    puzzle.openCoolant();
    expect(puzzle.startGenerator()).toBe('ok');
    expect(puzzle.ventilation).toBe(true);
    expect(puzzle.sealDampers()).toBe('fault-airflow');
    // The fault dropped the generator, but the hand valve stays open.
    expect(puzzle.generator).toBe(false);
    expect(puzzle.coolant).toBe(true);
  });

  it('refuses to release an unsealed chamber', () => {
    const puzzle = new CentralSystemPuzzle();
    expect(puzzle.release()).toBe('fault-unsealed');
    expect(puzzle.solved).toBe(false);
  });

  it('solves when operated in the order implied by the dependencies', () => {
    const puzzle = new CentralSystemPuzzle();
    puzzle.insertKey();
    puzzle.openCoolant();
    expect(puzzle.startGenerator()).toBe('ok');
    expect(puzzle.toggleVentilation()).toBe('ok');
    expect(puzzle.ventilation).toBe(false);
    expect(puzzle.sealDampers()).toBe('ok');
    expect(puzzle.release()).toBe('ok');
    expect(puzzle.solved).toBe(true);
  });

  it('cannot toggle the fans without power', () => {
    const puzzle = new CentralSystemPuzzle();
    expect(puzzle.toggleVentilation()).toBe('no-power');
  });
});

describe('KeypadPuzzle', () => {
  it('counts failures and accepts the right code', () => {
    const keypad = new KeypadPuzzle('1961', 'TEST');
    expect(keypad.enter('0000')).toBe(false);
    expect(keypad.fails).toBe(1);
    expect(keypad.enter('1961')).toBe(true);
    expect(keypad.solved).toBe(true);
  });
});
