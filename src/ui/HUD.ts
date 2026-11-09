// What's on screen during play. It stays deliberately sparse: most of it fades away
// when it isn't telling the player anything new.

import { InteractionPrompt } from '../interaction/InteractionPrompt';
import { el, keyLabel } from './dom';
import type { SettingsData } from '../core/Settings';

const OBJECTIVE_SHOW_TIME = 7;
const CONTROLS_SHOW_TIME = 16;

export class HUD {
  readonly root: HTMLElement;
  readonly prompt = new InteractionPrompt();
  private objective = el('div', 'hud-objective');
  private objectiveText = el('div', 'hud-objective-text');
  private subtitle = el('div', 'hud-subtitle');
  private toasts = el('div', 'hud-toast');
  private status = el('div', 'hud-status');
  private batteryFill = el('div');
  private noiseBar = el('div', 'hud-bar hud-noise-bar');
  private noiseFill = el('div');
  private saveIndicator = el('div', 'hud-save', [el('i'), 'Saving']);
  private dot = el('div', 'hud-dot');
  private controls = el('div', 'hud-controls');
  private mouseHint = el('div', 'hud-mouse-hint', 'Click to look around. Or drag to look.');
  private objectiveTimer = 0;
  private subtitleQueue: { text: string; hold: number }[] = [];
  private subtitleTimer = 0;
  private saveTimer = 0;
  private statusTimer = 0;
  private controlsTimer = 0;
  private hushing = false;

  constructor() {
    this.root = el('div', 'hud');
    this.objective.append(el('div', 'label', 'Objective'), this.objectiveText);
    this.objective.style.opacity = '0';
    this.subtitle.style.opacity = '0';
    this.saveIndicator.style.opacity = '0';
    this.controls.style.opacity = '0';
    const batteryBar = el('div', 'hud-bar');
    batteryBar.append(this.batteryFill);
    this.noiseBar.append(this.noiseFill);
    this.status.append(
      el('div', 'hud-meter', [el('span', 'label', 'Torch'), batteryBar]),
      el('div', 'hud-meter', [el('span', 'label', 'Noise'), this.noiseBar]),
    );
    this.status.style.opacity = '0';
    this.mouseHint.style.opacity = '0';
    this.root.append(this.objective, this.status, this.subtitle, this.toasts, this.saveIndicator, this.dot, this.controls, this.mouseHint, this.prompt.root);
    this.root.style.display = 'none';
  }

  setVisible(visible: boolean): void {
    this.root.style.display = visible ? 'block' : 'none';
    if (!visible) this.clearSubtitles();
  }

  /** Shown when the browser has released the mouse, as it does after Escape. */
  setMouseHint(visible: boolean): void {
    this.mouseHint.style.opacity = visible ? '1' : '0';
  }

  setCovered(covered: boolean): void {
    this.root.classList.toggle('covered', covered);
  }

  setObjective(text: string, flash = true): void {
    this.objectiveText.textContent = text;
    if (flash) {
      this.objectiveTimer = OBJECTIVE_SHOW_TIME;
      this.objective.style.opacity = '1';
    }
  }

  /** Puts the current objective back on screen for a moment, without changing it. */
  showObjective(): void {
    this.objectiveTimer = OBJECTIVE_SHOW_TIME;
    this.objective.style.opacity = '1';
  }

  showControls(settings: SettingsData): void {
    const bindings = settings.bindings;
    const hint = (code: string, label: string) => el('span', '', [el('span', 'keycap', keyLabel(code)), label]);
    this.controls.replaceChildren(
      hint(`${bindings.forward}`, 'Move (WASD)'),
      hint(bindings.run, 'Run'),
      hint(bindings.crouch, 'Crouch'),
      hint(bindings.interact, 'Use'),
      hint(bindings.flashlight, 'Torch'),
      hint(bindings.inventory, 'Bag'),
      hint(bindings.journal, 'Journal'),
    );
    this.controls.style.opacity = '1';
    this.controlsTimer = CONTROLS_SHOW_TIME;
  }

  say(text: string, hold = 0): void {
    // Text is held long enough to be read at a comfortable pace, unless told otherwise.
    const duration = hold > 0 ? hold : Math.max(2.8, text.length * 0.058);
    this.subtitleQueue.push({ text, hold: duration });
    if (this.subtitleTimer <= 0) this.nextSubtitle();
  }

  private nextSubtitle(): void {
    const next = this.subtitleQueue.shift();
    if (!next) {
      this.subtitle.style.opacity = '0';
      return;
    }
    this.subtitle.textContent = next.text;
    this.subtitle.style.opacity = '1';
    this.subtitleTimer = next.hold;
  }

  clearSubtitles(): void {
    this.subtitleQueue = [];
    this.subtitleTimer = 0;
    this.subtitle.style.opacity = '0';
  }

  toast(text: string): void {
    const toast = el('div', 'toast', text);
    this.toasts.append(toast);
    window.setTimeout(() => toast.remove(), 3700);
  }

  showSaving(): void {
    this.saveIndicator.style.opacity = '1';
    this.saveTimer = 1.8;
  }

  /** During a Hush, only the noise meter matters, so it stays up and everything else goes. */
  setHush(active: boolean): void {
    this.hushing = active;
    if (active) {
      this.objective.style.opacity = '0';
      this.status.style.opacity = '1';
    }
  }

  setCrosshairVisible(visible: boolean): void {
    this.dot.style.opacity = visible ? '1' : '0';
  }

  update(dt: number, battery: number, noise: number): void {
    if (this.objectiveTimer > 0) {
      this.objectiveTimer -= dt;
      if (this.objectiveTimer <= 0) this.objective.style.opacity = '0';
    }
    if (this.subtitleTimer > 0) {
      this.subtitleTimer -= dt;
      if (this.subtitleTimer <= 0) this.nextSubtitle();
    }
    if (this.saveTimer > 0) {
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) this.saveIndicator.style.opacity = '0';
    }
    if (this.controlsTimer > 0) {
      this.controlsTimer -= dt;
      if (this.controlsTimer <= 0) this.controls.style.opacity = '0';
    }

    this.batteryFill.style.width = `${battery.toFixed(1)}%`;
    this.batteryFill.style.background = battery < 15 ? 'var(--alert)' : '#d8d2bf';
    this.noiseFill.style.width = `${(noise * 100).toFixed(0)}%`;
    this.noiseBar.classList.toggle('loud', noise > 0.2);

    // The status lines come up when something's changing, and fade once they settle.
    if (battery < 15 || noise > 0.5 || this.hushing) this.statusTimer = 3;
    if (this.statusTimer > 0) {
      this.statusTimer -= dt;
      this.status.style.opacity = '1';
    } else {
      this.status.style.opacity = '0';
    }
  }
}
