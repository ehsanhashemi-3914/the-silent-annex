import type { GameAction, QualityLevel, Settings, SettingsData } from '../core/Settings';
import { button, el, keyLabel } from './dom';
import type { Screen } from './UIManager';

const ACTION_LABELS: Record<GameAction, string> = {
  forward: 'Move forward',
  back: 'Move back',
  left: 'Move left',
  right: 'Move right',
  run: 'Run',
  crouch: 'Crouch',
  interact: 'Interact',
  flashlight: 'Torch',
  inventory: 'Inventory',
  journal: 'Journal',
  pause: 'Pause',
};

export class SettingsUI implements Screen {
  readonly root: HTMLElement;
  private body: HTMLElement;
  private listening: { action: GameAction; element: HTMLButtonElement } | null = null;

  constructor(
    private settings: Settings,
    onBack: () => void,
    private playSound: (name: string) => void,
  ) {
    this.root = el('div', 'screen overlay-screen');
    const panel = el('div', 'panel');
    this.body = el('div', 'panel-body');
    panel.append(
      el('div', 'panel-header', [el('h2', 'panel-title', 'Settings')]),
      this.body,
      el('div', 'panel-footer', [
        button('text-button', 'Restore Defaults', () => {
          this.settings.reset();
          this.playSound('ui:select');
          this.render();
        }),
        button('text-button', 'Back', onBack),
      ]),
    );
    this.root.append(panel);
    this.render();
  }

  onKey(code: string, event: KeyboardEvent): boolean {
    if (!this.listening) return false;
    event.preventDefault();
    if (code !== 'Escape') this.bind(this.listening.action, code);
    this.listening = null;
    this.render();
    return true;
  }

  /** Assigns a key, swapping with whatever action held it, so no action is left without one. */
  private bind(action: GameAction, code: string): void {
    const bindings = { ...this.settings.data.bindings };
    const previous = bindings[action];
    for (const other of Object.keys(bindings) as GameAction[]) {
      if (other !== action && bindings[other] === code) bindings[other] = previous;
    }
    bindings[action] = code;
    this.settings.update({ bindings });
    this.playSound('ui:select');
  }

  private slider(label: string, key: keyof SettingsData, min: number, max: number, step: number, format: (value: number) => string): HTMLElement {
    const value = this.settings.data[key] as number;
    const input = el('input', '', undefined, { type: 'range', min, max, step, value, 'aria-label': label });
    const readout = el('span', 'setting-value', format(value));
    input.addEventListener('input', () => {
      const next = Number(input.value);
      readout.textContent = format(next);
      this.settings.update({ [key]: next } as Partial<SettingsData>);
    });
    return el('div', 'setting-row', [el('span', '', label), el('div', 'setting-control', [input, readout])]);
  }

  private toggle(label: string, key: 'invertY' | 'cinematicCameras'): HTMLElement {
    const value = this.settings.data[key];
    const segment = el('div', 'segmented', [
      this.segmentButton('Off', !value, () => this.settings.update({ [key]: false } as Partial<SettingsData>)),
      this.segmentButton('On', value, () => this.settings.update({ [key]: true } as Partial<SettingsData>)),
    ]);
    return el('div', 'setting-row', [el('span', '', label), el('div', 'setting-control', [segment])]);
  }

  private segmentButton(text: string, active: boolean, onClick: () => void): HTMLButtonElement {
    const element = el('button', active ? 'active' : '', text, { type: 'button' });
    element.addEventListener('click', () => {
      onClick();
      this.playSound('ui:select');
      this.render();
    });
    return element;
  }

  private render(): void {
    const percent = (value: number) => `${Math.round(value * 100)}`;
    const data = this.settings.data;

    const qualityRow = el('div', 'setting-row', [
      el('span', '', 'Graphics quality'),
      el('div', 'setting-control', [
        el(
          'div',
          'segmented',
          (['low', 'medium', 'high'] as QualityLevel[]).map((level) =>
            this.segmentButton(level, data.quality === level, () => this.settings.update({ quality: level })),
          ),
        ),
      ]),
    ]);

    const fullscreen = el('div', 'setting-row', [
      el('span', '', 'Fullscreen'),
      el('div', 'setting-control', [
        el('div', 'segmented', [
          this.segmentButton('Off', !document.fullscreenElement, () => {
            if (document.fullscreenElement) void document.exitFullscreen();
          }),
          this.segmentButton('On', Boolean(document.fullscreenElement), () => {
            void document.documentElement.requestFullscreen?.().catch(() => {});
          }),
        ]),
      ]),
    ]);

    const bindings = (Object.keys(ACTION_LABELS) as GameAction[]).map((action) => {
      const bindButton = el('button', 'bind-button', keyLabel(data.bindings[action]), { type: 'button' });
      bindButton.addEventListener('click', () => {
        this.listening = { action, element: bindButton };
        bindButton.textContent = 'Press a key';
        bindButton.classList.add('listening');
      });
      return el('div', 'setting-row', [el('span', '', ACTION_LABELS[action]), el('div', 'setting-control', [bindButton])]);
    });

    this.body.replaceChildren(
      el('div', 'settings-group', [
        el('span', 'label', 'Display'),
        this.slider('Brightness', 'brightness', 0.5, 2, 0.05, percent),
        qualityRow,
        this.slider('Resolution scale', 'renderScale', 0.5, 1, 0.05, percent),
        this.slider('Field of view', 'fov', 50, 85, 1, (value) => `${Math.round(value)}`),
        this.toggle('Cinematic cameras', 'cinematicCameras'),
        fullscreen,
      ]),
      el('div', 'settings-group', [
        el('span', 'label', 'Sound'),
        this.slider('Master volume', 'masterVolume', 0, 1, 0.01, percent),
        this.slider('Music volume', 'musicVolume', 0, 1, 0.01, percent),
        this.slider('Effects volume', 'sfxVolume', 0, 1, 0.01, percent),
        this.slider('Ambient volume', 'ambientVolume', 0, 1, 0.01, percent),
      ]),
      el('div', 'settings-group', [
        el('span', 'label', 'Controls'),
        this.slider('Mouse sensitivity', 'mouseSensitivity', 0.2, 3, 0.05, (value) => value.toFixed(2)),
        this.toggle('Invert vertical look', 'invertY'),
        ...bindings,
      ]),
    );
  }
}
