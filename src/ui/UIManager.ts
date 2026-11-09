// A stack of screens. Whatever is on top gets the keyboard, and the game is paused
// while the stack holds anything. That one rule takes care of a surprising number
// of cases, such as a settings screen opened from the pause menu opened from play.

import { el } from './dom';

export interface Screen {
  readonly root: HTMLElement;
  /** Returning true means the screen has handled this key. */
  onKey?(code: string, event: KeyboardEvent): boolean;
  onOpen?(): void;
  onClose?(): void;
  /** Can the player back out of this with Escape? */
  readonly dismissible?: boolean;
  /** Keeps the 3D view visible and clear behind this screen. */
  update?(dt: number): void;
}

export interface UISound {
  (name: string): void;
}

export class UIManager {
  private stack: Screen[] = [];
  readonly layer: HTMLElement;
  readonly hudLayer: HTMLElement;
  readonly fade: HTMLElement;
  private navIndex = -1;
  private fadeTimer: number | null = null;
  onStackChange: ((blocking: boolean) => void) | null = null;

  constructor(
    root: HTMLElement,
    readonly playSound: UISound,
  ) {
    this.hudLayer = el('div', 'hud-layer');
    this.layer = el('div', 'screen-layer');
    this.fade = el('div', 'fade-layer');
    // The HUD goes above screens, as Ilse's remarks must stay readable over a puzzle panel.
    root.append(this.layer, this.hudLayer, this.fade);

    // A soft tick when the pointer moves onto anything clickable, so the UI feels physical.
    root.addEventListener('mouseover', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest?.('[data-nav]') && !(target.closest('[data-nav]') as HTMLButtonElement).disabled) {
        if (event.relatedTarget && (event.relatedTarget as HTMLElement).closest?.('[data-nav]') === target.closest('[data-nav]')) return;
        playSound('ui:hover');
      }
    });
  }

  get blocking(): boolean {
    return this.stack.length > 0;
  }

  get top(): Screen | undefined {
    return this.stack[this.stack.length - 1];
  }

  open(screen: Screen): void {
    this.stack.push(screen);
    this.layer.append(screen.root);
    this.navIndex = -1;
    screen.onOpen?.();
    this.onStackChange?.(true);
  }

  /** Closes the top screen. */
  close(): void {
    const screen = this.stack.pop();
    if (!screen) return;
    screen.onClose?.();
    screen.root.remove();
    this.navIndex = -1;
    this.onStackChange?.(this.blocking);
  }

  closeAll(): void {
    while (this.stack.length > 0) this.close();
  }

  /** Replaces the whole stack with one screen, for moves such as menu to game. */
  replaceAll(screen: Screen): void {
    this.closeAll();
    this.open(screen);
  }

  handleKey(code: string, event: KeyboardEvent): boolean {
    const top = this.top;
    if (!top) return false;
    if (top.onKey?.(code, event)) return true;
    if (code === 'Escape' && top.dismissible !== false) {
      this.playSound('ui:back');
      this.close();
      return true;
    }
    return this.handleNavigation(code, event, top);
  }

  /** Lets arrow keys and Enter work on any menu, without each screen writing its own. */
  private handleNavigation(code: string, event: KeyboardEvent, screen: Screen): boolean {
    if (code !== 'ArrowDown' && code !== 'ArrowUp' && code !== 'Enter') return false;
    const items = Array.from(screen.root.querySelectorAll<HTMLElement>('[data-nav]')).filter((item) => !(item as HTMLButtonElement).disabled);
    if (items.length === 0) return false;
    event.preventDefault();
    if (code === 'Enter') {
      if (this.navIndex >= 0) items[this.navIndex]?.click();
      return this.navIndex >= 0;
    }
    items.forEach((item) => item.classList.remove('nav-focus'));
    const direction = code === 'ArrowDown' ? 1 : -1;
    this.navIndex = this.navIndex < 0 ? (direction > 0 ? 0 : items.length - 1) : (this.navIndex + direction + items.length) % items.length;
    items[this.navIndex].classList.add('nav-focus');
    items[this.navIndex].scrollIntoView?.({ block: 'nearest' });
    this.playSound('ui:hover');
    return true;
  }

  update(dt: number): void {
    this.top?.update?.(dt);
  }

  /** Fades the whole screen to a colour, resolving when it has got there. */
  fadeTo(opacity: number, seconds: number, white = false): Promise<void> {
    this.fade.classList.toggle('white', white);
    this.fade.style.transitionDuration = `${seconds}s`;
    this.fade.style.opacity = String(opacity);
    return new Promise((resolve) => {
      if (this.fadeTimer !== null) window.clearTimeout(this.fadeTimer);
      this.fadeTimer = window.setTimeout(resolve, seconds * 1000);
    });
  }
}
