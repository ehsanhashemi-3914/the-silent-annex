import type { GameAction, Settings } from './Settings';

const STICK_DEADZONE = 0.18;
const PAD_LOOK_SPEED = 16;

/**
 * Translates raw devices into game actions, so gameplay code asks "is the player
 * running?" rather than "is the Shift key down?". Rebinding keys or adding a gamepad
 * then doesn't require changing any of the gameplay code.
 */
export class InputManager {
  private down = new Set<string>();
  private pressed = new Set<GameAction>();
  private actionsByCode = new Map<string, GameAction>();
  private mouseDX = 0;
  private mouseDY = 0;
  private dragging = false;
  private lastPadButtons: boolean[] = [];
  private listeners: [EventTarget, string, EventListener][] = [];
  private padMoveX = 0;
  private padMoveY = 0;
  private padRun = false;
  /** While false, gameplay reads nothing, for example while a menu is open. */
  enabled = false;
  /** Lets automated checks walk the character without real key presses. */
  scriptedMove: { x: number; y: number; run: boolean } | null = null;
  /**
   * Offered every key press first, so the UI can use it. Returning true means it was used
   * up: closing the inventory with Tab must not also count as a press that reopens it.
   */
  onKeyDown: ((code: string, event: KeyboardEvent) => boolean) | null = null;

  constructor(
    private element: HTMLElement,
    private settings: Settings,
  ) {
    this.rebuildBindings();
    settings.onChange(() => this.rebuildBindings());
    this.listen(window, 'keydown', (event) => this.handleKeyDown(event as KeyboardEvent));
    this.listen(window, 'keyup', (event) => this.down.delete((event as KeyboardEvent).code));
    this.listen(window, 'blur', () => this.down.clear());
    this.listen(document, 'mousemove', (event) => this.handleMouseMove(event as MouseEvent));
    this.listen(element, 'mousedown', () => {
      this.dragging = true;
    });
    this.listen(window, 'mouseup', () => {
      this.dragging = false;
    });
  }

  private listen(target: EventTarget, type: string, handler: EventListener): void {
    target.addEventListener(type, handler);
    this.listeners.push([target, type, handler]);
  }

  private rebuildBindings(): void {
    this.actionsByCode.clear();
    const bindings = this.settings.data.bindings;
    for (const action of Object.keys(bindings) as GameAction[]) this.actionsByCode.set(bindings[action], action);
  }

  private handleKeyDown(event: KeyboardEvent): void {
    // A held key is still held, even if a menu took the original press.
    if (!event.repeat) this.down.add(event.code);
    const consumed = !event.repeat && this.onKeyDown?.(event.code, event) === true;
    // Stop Tab from moving focus, and arrow keys from scrolling, while the game has control.
    if (this.enabled && (event.code === 'Tab' || event.code === 'Space' || event.code.startsWith('Arrow'))) {
      event.preventDefault();
    }
    if (event.repeat || consumed) return;
    const action = this.actionsByCode.get(event.code);
    if (action) this.pressed.add(action);
  }

  private handleMouseMove(event: MouseEvent): void {
    // With pointer lock, every movement counts. Without it, look only while dragging,
    // so the game stays playable where pointer lock is refused.
    if (document.pointerLockElement === this.element || this.dragging) {
      this.mouseDX += event.movementX;
      this.mouseDY += event.movementY;
    }
  }

  requestPointerLock(): void {
    // Browsers can refuse this, and some return a rejected promise rather than throwing.
    try {
      const result = this.element.requestPointerLock() as unknown as Promise<void> | undefined;
      result?.catch?.(() => {});
    } catch {
      // Drag-to-look still works.
    }
  }

  exitPointerLock(): void {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /** Reads the gamepad, once per frame. Buttons become the same presses as keyboard keys. */
  pollGamepad(): void {
    this.padMoveX = 0;
    this.padMoveY = 0;
    this.padRun = false;
    const pad = navigator.getGamepads?.().find((candidate) => candidate?.connected);
    if (!pad) return;
    const deadzone = (value: number) => (Math.abs(value) < STICK_DEADZONE ? 0 : value);
    this.padMoveX = deadzone(pad.axes[0] ?? 0);
    this.padMoveY = deadzone(pad.axes[1] ?? 0);
    this.mouseDX += deadzone(pad.axes[2] ?? 0) * PAD_LOOK_SPEED;
    this.mouseDY += deadzone(pad.axes[3] ?? 0) * PAD_LOOK_SPEED;
    this.padRun = pad.buttons[10]?.pressed === true || (pad.buttons[7]?.value ?? 0) > 0.4;
    const map: [number, GameAction][] = [
      [0, 'interact'],
      [2, 'flashlight'],
      [1, 'crouch'],
      [3, 'inventory'],
      [8, 'journal'],
      [9, 'pause'],
    ];
    for (const [index, action] of map) {
      const pressed = pad.buttons[index]?.pressed === true;
      if (pressed && !this.lastPadButtons[index]) this.pressed.add(action);
      this.lastPadButtons[index] = pressed;
    }
  }

  isDown(action: GameAction): boolean {
    return this.enabled && this.down.has(this.settings.data.bindings[action]);
  }

  /** True once per press. Reading it consumes the press. */
  consumePress(action: GameAction): boolean {
    const was = this.pressed.has(action);
    this.pressed.delete(action);
    return was && this.enabled;
  }

  /** The look movement since the last call, cleared on reading. */
  consumeLook(): { x: number; y: number } {
    const look = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return look;
  }

  /** Movement intent as x (strafe) and y (forward), from keys or the stick. */
  moveAxis(): { x: number; y: number } {
    if (!this.enabled) return { x: 0, y: 0 };
    if (this.scriptedMove) return { x: this.scriptedMove.x, y: this.scriptedMove.y };
    const x = Number(this.isDown('right')) - Number(this.isDown('left')) + this.padMoveX;
    const y = Number(this.isDown('forward')) - Number(this.isDown('back')) - this.padMoveY;
    return { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) };
  }

  get running(): boolean {
    if (this.scriptedMove) return this.scriptedMove.run;
    return this.isDown('run') || (this.enabled && this.padRun);
  }

  /** Drops any presses queued while a menu was open, so they don't fire after it closes. */
  clearPresses(): void {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }

  dispose(): void {
    for (const [target, type, handler] of this.listeners) target.removeEventListener(type, handler);
    this.listeners = [];
  }
}
