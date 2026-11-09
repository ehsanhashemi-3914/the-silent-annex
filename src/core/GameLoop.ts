const FIXED_STEP = 1 / 60;
const MAX_FRAME = 0.25;

export interface LoopCallbacks {
  /** Runs at a constant 60 Hz, however fast the display is. Physics belongs here. */
  fixedUpdate(dt: number): void;
  /** Runs once per displayed frame. `alpha` says how far we are between two physics steps. */
  update(dt: number, alpha: number): void;
}

/**
 * The heartbeat of the game. Physics needs a steady timestep to stay stable, but screens
 * refresh at all sorts of rates, so time is banked in an accumulator and spent in
 * fixed slices. Rendering then happens once per frame, whatever was left over.
 */
export class GameLoop {
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private frameHandle = 0;

  constructor(private callbacks: LoopCallbacks) {
    document.addEventListener('visibilitychange', this.handleVisibility);
  }

  private handleVisibility = (): void => {
    // Browsers suspend hidden tabs. Without this, the time spent hidden would all be
    // simulated at once on return.
    this.lastTime = performance.now();
    this.accumulator = 0;
  };

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.frameHandle);
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    this.frameHandle = requestAnimationFrame(this.tick);
    // A long stall such as a garbage collection pause is capped rather than simulated in full.
    const frame = Math.min(MAX_FRAME, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.accumulator += frame;
    while (this.accumulator >= FIXED_STEP) {
      this.callbacks.fixedUpdate(FIXED_STEP);
      this.accumulator -= FIXED_STEP;
    }
    this.callbacks.update(frame, this.accumulator / FIXED_STEP);
  };

  dispose(): void {
    this.stop();
    document.removeEventListener('visibilitychange', this.handleVisibility);
  }
}
