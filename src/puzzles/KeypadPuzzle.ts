export interface KeypadSnapshot {
  solved: boolean;
  fails: number;
}

/** A plain numeric code lock, used for the records room door and the director's safe. */
export class KeypadPuzzle {
  solved = false;
  fails = 0;

  constructor(
    readonly code: string,
    readonly title: string,
  ) {}

  get length(): number {
    return this.code.length;
  }

  enter(attempt: string): boolean {
    if (this.solved) return true;
    if (attempt === this.code) {
      this.solved = true;
      return true;
    }
    this.fails++;
    return false;
  }

  snapshot(): KeypadSnapshot {
    return { solved: this.solved, fails: this.fails };
  }

  restore(raw: unknown): void {
    const data = raw as Partial<KeypadSnapshot> | null;
    this.solved = data?.solved === true;
    this.fails = typeof data?.fails === 'number' ? data.fails : 0;
  }
}
