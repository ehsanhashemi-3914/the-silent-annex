import type { Action, PuzzleId } from '../core/Script';
import { ArchivePuzzle } from './ArchivePuzzle';
import { CentralSystemPuzzle } from './CentralSystemPuzzle';
import { ElectricalPuzzle, type BreakerId, type EnergiseResult } from './ElectricalPuzzle';
import { KeypadPuzzle } from './KeypadPuzzle';
import type { CentralResult } from './CentralSystemPuzzle';

/** Services a puzzle needs from the session, kept narrow to avoid a circular import. */
export interface PuzzleHost {
  run(actions: Action[]): void;
  hasItem(itemId: string): boolean;
  takeItem(itemId: string): boolean;
  puzzleSolved(puzzleId: PuzzleId): void;
  puzzleFailed(puzzleId: PuzzleId, reason: string): void;
  puzzleChanged(puzzleId: PuzzleId): void;
}

const ELECTRICAL_MESSAGES: Record<EnergiseResult, string> = {
  solved: '',
  'no-fuse': 'Nothing. Socket F3 is empty.',
  short: "The west bus is shorted. That tag wasn't a suggestion.",
  backfeed: 'Main and reserve fighting each other. Aune warned about that.',
  'no-feed': "No feed. The reserve line is dead, so it has to come through main.",
  'no-load': 'Main holds, but no load. Nothing reaches the research wing.',
};

const CENTRAL_MESSAGES: Record<CentralResult, string> = {
  ok: '',
  'no-key': 'The generator needs an ignition key. Empty keyway.',
  'no-power': 'No power on that circuit.',
  'fault-overtemp': 'GENERATOR TRIP: JACKET OVERTEMP. It ran dry. No coolant reaching it.',
  'fault-airflow': 'DAMPER FAULT: AIRFLOW DETECTED. They will not seat against moving air.',
  'fault-no-power': 'DAMPER FAULT: NO SUPPLY. The motors have nothing to run on.',
  'fault-unsealed': 'INTERLOCK: CHAMBER UNSEALED. The door will not release.',
};

const ARCHIVE_HINTS: Record<number, string> = {
  2: "It wants a catalogue number. There's a filing guide on the corridor wall.",
  4: 'The series and test number should be on the Test 44 log, in the observation room.',
  6: "The time of recording. When did it stop? Every clock in this place can tell me that.",
};

export class PuzzleManager {
  readonly recordsKeypad = new KeypadPuzzle('1961', 'RECORDS ROOM');
  readonly directorSafe = new KeypadPuzzle('1410', "DIRECTOR'S SAFE");
  readonly electrical = new ElectricalPuzzle();
  readonly archive = new ArchivePuzzle();
  readonly central = new CentralSystemPuzzle();

  constructor(private host: PuzzleHost) {}

  isSolved(id: PuzzleId): boolean {
    return this.get(id).solved;
  }

  private get(id: PuzzleId) {
    switch (id) {
      case 'records_keypad':
        return this.recordsKeypad;
      case 'director_safe':
        return this.directorSafe;
      case 'electrical':
        return this.electrical;
      case 'archive':
        return this.archive;
      case 'central':
        return this.central;
    }
  }

  // Keypads

  enterCode(id: 'records_keypad' | 'director_safe', code: string): boolean {
    const puzzle = id === 'records_keypad' ? this.recordsKeypad : this.directorSafe;
    const wasSolved = puzzle.solved;
    const ok = puzzle.enter(code);
    if (ok && !wasSolved) this.host.puzzleSolved(id);
    if (!ok) this.host.puzzleFailed(id, 'The light stays red.');
    return ok;
  }

  // Puzzle A

  /** Fits the fuse from the inventory. Returns false if the player isn't carrying one. */
  seatFuse(): boolean {
    if (this.electrical.fuseSeated) return true;
    if (!this.host.takeItem('fuse_30a')) return false;
    this.electrical.seatFuse();
    this.host.puzzleChanged('electrical');
    return true;
  }

  toggleBreaker(id: BreakerId): void {
    this.electrical.toggle(id);
    this.host.puzzleChanged('electrical');
  }

  energise(): EnergiseResult {
    const result = this.electrical.energise();
    if (result === 'solved') this.host.puzzleSolved('electrical');
    else this.host.puzzleFailed('electrical', ELECTRICAL_MESSAGES[result]);
    this.host.puzzleChanged('electrical');
    return result;
  }

  // Puzzle B

  rotateDial(index: number, direction: 1 | -1): void {
    this.archive.rotate(index, direction);
    this.host.puzzleChanged('archive');
  }

  pullArchiveLever(): boolean {
    const wasSolved = this.archive.solved;
    const ok = this.archive.pull();
    if (ok && !wasSolved) this.host.puzzleSolved('archive');
    if (!ok) {
      this.host.puzzleFailed('archive', 'NO SUCH ITEM. The lever snaps back.');
      const hint = ARCHIVE_HINTS[this.archive.fails];
      if (hint) this.host.run([{ say: hint }]);
    }
    this.host.puzzleChanged('archive');
    return ok;
  }

  // Puzzle C

  openCoolant(): void {
    this.central.openCoolant();
    this.host.puzzleChanged('central');
  }

  /** Inserts the ignition key from the inventory into the generator panel. */
  insertIgnitionKey(): boolean {
    if (this.central.keyInserted) return true;
    if (!this.host.takeItem('ignition_key')) return false;
    this.central.insertKey();
    this.host.puzzleChanged('central');
    return true;
  }

  operateCentral(control: 'generator' | 'ventilation' | 'dampers' | 'release'): CentralResult {
    const result =
      control === 'generator'
        ? this.central.startGenerator()
        : control === 'ventilation'
          ? this.central.toggleVentilation()
          : control === 'dampers'
            ? this.central.sealDampers()
            : this.central.release();
    if (result !== 'ok') this.host.puzzleFailed('central', CENTRAL_MESSAGES[result]);
    else if (control === 'release' && this.central.solved) this.host.puzzleSolved('central');
    this.host.puzzleChanged('central');
    return result;
  }

  // Saving

  snapshot(): Record<PuzzleId, unknown> {
    return {
      records_keypad: this.recordsKeypad.snapshot(),
      director_safe: this.directorSafe.snapshot(),
      electrical: this.electrical.snapshot(),
      archive: this.archive.snapshot(),
      central: this.central.snapshot(),
    };
  }

  restore(data: Partial<Record<PuzzleId, unknown>>): void {
    this.recordsKeypad.restore(data.records_keypad);
    this.directorSafe.restore(data.director_safe);
    this.electrical.restore(data.electrical);
    this.archive.restore(data.archive);
    this.central.restore(data.central);
  }
}
