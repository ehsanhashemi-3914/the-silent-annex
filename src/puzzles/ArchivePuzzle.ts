export const SERIES_LETTERS = ['A', 'B', 'G', 'S'] as const;

/** The dials as shown on the panel: series letter, two test digits, four time digits. */
export const DIAL_COUNT = 7;

export interface ArchiveSnapshot {
  dials: number[];
  solved: boolean;
  fails: number;
}

/**
 * PUZZLE B: the archive call-number lock, read as SERIES / TEST / TIME.
 *
 * Three clues found in different places combine into one number:
 *  - the corridor filing poster explains the format and the series letters;
 *  - the Test 44 log names the Geophonic programme and the test number;
 *  - every stopped clock in the building shows the time of recording, 03:17.
 */
export class ArchivePuzzle {
  static readonly SOLUTION = [2, 4, 4, 0, 3, 1, 7];

  dials: number[] = new Array(DIAL_COUNT).fill(0);
  solved = false;
  fails = 0;

  dialRange(index: number): number {
    return index === 0 ? SERIES_LETTERS.length : 10;
  }

  rotate(index: number, direction: 1 | -1): void {
    if (this.solved || index < 0 || index >= DIAL_COUNT) return;
    const range = this.dialRange(index);
    this.dials[index] = (this.dials[index] + direction + range) % range;
  }

  /** Text shown for one dial, for example "G" or "4". */
  label(index: number): string {
    return index === 0 ? SERIES_LETTERS[this.dials[0]] : String(this.dials[index]);
  }

  /** Pulls the retrieval lever. A wrong number counts toward Ilse's escalating hints. */
  pull(): boolean {
    if (this.solved) return true;
    if (this.dials.every((value, i) => value === ArchivePuzzle.SOLUTION[i])) {
      this.solved = true;
      return true;
    }
    this.fails++;
    return false;
  }

  snapshot(): ArchiveSnapshot {
    return { dials: [...this.dials], solved: this.solved, fails: this.fails };
  }

  restore(raw: unknown): void {
    const data = raw as Partial<ArchiveSnapshot> | null;
    this.solved = data?.solved === true;
    this.fails = typeof data?.fails === 'number' ? data.fails : 0;
    if (Array.isArray(data?.dials) && data.dials.length === DIAL_COUNT) {
      this.dials = data.dials.map((value, i) => {
        const range = this.dialRange(i);
        return Number.isInteger(value) && value >= 0 && value < range ? value : 0;
      });
    }
  }
}
