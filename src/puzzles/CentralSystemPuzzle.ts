export type CentralResult =
  | 'ok'
  | 'no-key'
  | 'no-power'
  | 'fault-overtemp'
  | 'fault-airflow'
  | 'fault-no-power'
  | 'fault-unsealed';

export interface CentralSnapshot {
  coolant: boolean;
  keyInserted: boolean;
  generator: boolean;
  ventilation: boolean;
  dampers: boolean;
  solved: boolean;
  faults: number;
}

/**
 * PUZZLE C: bringing the Annex back online. Nothing states the order directly.
 * It follows from how the systems depend on each other:
 *
 *   coolant valve -> generator -> (fans start by themselves) -> fans off -> dampers -> release
 *
 * A fault trips everything downstream of the coolant valve, which stays open
 * because it is a physical hand wheel out in the corridor.
 */
export class CentralSystemPuzzle {
  coolant = false;
  keyInserted = false;
  generator = false;
  ventilation = false;
  dampers = false;
  solved = false;
  faults = 0;

  openCoolant(): void {
    this.coolant = true;
  }

  insertKey(): void {
    this.keyInserted = true;
  }

  startGenerator(): CentralResult {
    if (!this.keyInserted) return 'no-key';
    if (this.generator) return 'ok';
    if (!this.coolant) return this.fault('fault-overtemp');
    this.generator = true;
    // The fans are wired to the generator bus and always spin up with it.
    this.ventilation = true;
    return 'ok';
  }

  toggleVentilation(): CentralResult {
    if (!this.generator) return 'no-power';
    this.ventilation = !this.ventilation;
    return 'ok';
  }

  sealDampers(): CentralResult {
    if (this.dampers) return 'ok';
    if (!this.generator) return this.fault('fault-no-power');
    if (this.ventilation) return this.fault('fault-airflow');
    this.dampers = true;
    return 'ok';
  }

  release(): CentralResult {
    if (this.solved) return 'ok';
    if (!this.dampers) return this.fault('fault-unsealed');
    this.solved = true;
    return 'ok';
  }

  private fault(result: CentralResult): CentralResult {
    this.faults++;
    this.generator = false;
    this.ventilation = false;
    this.dampers = false;
    return result;
  }

  snapshot(): CentralSnapshot {
    return {
      coolant: this.coolant,
      keyInserted: this.keyInserted,
      generator: this.generator,
      ventilation: this.ventilation,
      dampers: this.dampers,
      solved: this.solved,
      faults: this.faults,
    };
  }

  restore(raw: unknown): void {
    const data = raw as Partial<CentralSnapshot> | null;
    this.coolant = data?.coolant === true;
    this.keyInserted = data?.keyInserted === true;
    this.generator = data?.generator === true;
    this.ventilation = data?.ventilation === true;
    this.dampers = data?.dampers === true;
    this.solved = data?.solved === true;
    this.faults = typeof data?.faults === 'number' ? data.faults : 0;
  }
}
