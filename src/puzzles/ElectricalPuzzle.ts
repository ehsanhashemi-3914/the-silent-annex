export type BreakerId = 'main' | 'west' | 'east' | 'reserve';

export const BREAKERS: readonly BreakerId[] = ['main', 'west', 'east', 'reserve'];

export type EnergiseResult = 'solved' | 'no-fuse' | 'short' | 'backfeed' | 'no-feed' | 'no-load';

export interface ElectricalSnapshot {
  fuseSeated: boolean;
  breakers: Record<BreakerId, boolean>;
  solved: boolean;
  trips: number;
}

/**
 * PUZZLE A: Board 2 in the electrical control room.
 *
 * The rules come from Aune's note and the tags on the panel:
 *  - the west bus has a dead short, so it must stay open;
 *  - main and reserve must never be closed together (backfeed);
 *  - the reserve line is dead, so main has to be the feed;
 *  - the research wing hangs off the east bus, which must be closed.
 * Only one configuration satisfies all four: main and east closed, west and reserve open.
 */
export class ElectricalPuzzle {
  fuseSeated = false;
  breakers: Record<BreakerId, boolean> = { main: false, west: true, east: false, reserve: true };
  solved = false;
  trips = 0;

  seatFuse(): void {
    this.fuseSeated = true;
  }

  toggle(id: BreakerId): void {
    if (!this.solved) this.breakers[id] = !this.breakers[id];
  }

  energise(): EnergiseResult {
    if (this.solved) return 'solved';
    if (!this.fuseSeated) return 'no-fuse';
    const { main, west, east, reserve } = this.breakers;
    if (west) return this.trip('short');
    if (main && reserve) return this.trip('backfeed');
    if (!main) return 'no-feed';
    if (!east) return 'no-load';
    this.solved = true;
    return 'solved';
  }

  /** A real fault throws the main breaker open, so the player has to reset it. */
  private trip(result: EnergiseResult): EnergiseResult {
    this.trips++;
    this.breakers.main = false;
    return result;
  }

  snapshot(): ElectricalSnapshot {
    return {
      fuseSeated: this.fuseSeated,
      breakers: { ...this.breakers },
      solved: this.solved,
      trips: this.trips,
    };
  }

  restore(raw: unknown): void {
    const data = raw as Partial<ElectricalSnapshot> | null;
    this.fuseSeated = data?.fuseSeated === true;
    this.solved = data?.solved === true;
    this.trips = typeof data?.trips === 'number' ? data.trips : 0;
    for (const id of BREAKERS) {
      const value = data?.breakers?.[id];
      if (typeof value === 'boolean') this.breakers[id] = value;
    }
  }
}
