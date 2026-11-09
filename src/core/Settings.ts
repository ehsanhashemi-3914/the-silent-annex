// Player preferences, stored separately from save games so that they outlive any playthrough.

export type QualityLevel = 'low' | 'medium' | 'high';

export type GameAction =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'run'
  | 'crouch'
  | 'interact'
  | 'flashlight'
  | 'inventory'
  | 'journal'
  | 'pause';

export const DEFAULT_BINDINGS: Record<GameAction, string> = {
  forward: 'KeyW',
  back: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  run: 'ShiftLeft',
  crouch: 'KeyC',
  interact: 'KeyE',
  flashlight: 'KeyF',
  inventory: 'Tab',
  journal: 'KeyJ',
  pause: 'Escape',
};

export interface SettingsData {
  mouseSensitivity: number;
  invertY: boolean;
  masterVolume: number;
  musicVolume: number;
  sfxVolume: number;
  ambientVolume: number;
  brightness: number;
  quality: QualityLevel;
  renderScale: number;
  fov: number;
  cinematicCameras: boolean;
  bindings: Record<GameAction, string>;
}

export const DEFAULT_SETTINGS: SettingsData = {
  mouseSensitivity: 1,
  invertY: false,
  masterVolume: 0.9,
  musicVolume: 0.7,
  sfxVolume: 0.9,
  ambientVolume: 0.85,
  brightness: 1,
  quality: 'high',
  renderScale: 1,
  fov: 62,
  cinematicCameras: true,
  bindings: { ...DEFAULT_BINDINGS },
};

const KEY = 'silent-annex.settings';

function inRange(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

/** Accepts anything from storage and returns settings that are safe to use. */
export function sanitizeSettings(raw: unknown): SettingsData {
  const data = (typeof raw === 'object' && raw !== null ? raw : {}) as Partial<SettingsData>;
  const d = DEFAULT_SETTINGS;
  const bindings = { ...DEFAULT_BINDINGS };
  if (typeof data.bindings === 'object' && data.bindings !== null) {
    for (const action of Object.keys(DEFAULT_BINDINGS) as GameAction[]) {
      const code = (data.bindings as Record<string, unknown>)[action];
      if (typeof code === 'string' && code.length > 0) bindings[action] = code;
    }
  }
  return {
    mouseSensitivity: inRange(data.mouseSensitivity, 0.2, 3, d.mouseSensitivity),
    invertY: data.invertY === true,
    masterVolume: inRange(data.masterVolume, 0, 1, d.masterVolume),
    musicVolume: inRange(data.musicVolume, 0, 1, d.musicVolume),
    sfxVolume: inRange(data.sfxVolume, 0, 1, d.sfxVolume),
    ambientVolume: inRange(data.ambientVolume, 0, 1, d.ambientVolume),
    brightness: inRange(data.brightness, 0.5, 2, d.brightness),
    quality: data.quality === 'low' || data.quality === 'medium' || data.quality === 'high' ? data.quality : d.quality,
    renderScale: inRange(data.renderScale, 0.5, 1, d.renderScale),
    fov: inRange(data.fov, 50, 85, d.fov),
    cinematicCameras: data.cinematicCameras !== false,
    bindings,
  };
}

export class Settings {
  data: SettingsData;
  private listeners = new Set<(data: SettingsData) => void>();

  /** `firstRunQuality` is used only when the player has never saved a choice of their own. */
  constructor(firstRunQuality: QualityLevel) {
    const stored = this.read();
    this.data = stored ? sanitizeSettings(stored) : { ...DEFAULT_SETTINGS, quality: firstRunQuality, bindings: { ...DEFAULT_BINDINGS } };
  }

  private read(): unknown {
    try {
      const text = localStorage.getItem(KEY);
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }

  update(changes: Partial<SettingsData>): void {
    this.data = sanitizeSettings({ ...this.data, ...changes });
    try {
      localStorage.setItem(KEY, JSON.stringify(this.data));
    } catch {
      // Settings still apply for this session if storage is unavailable.
    }
    for (const listener of this.listeners) listener(this.data);
  }

  /** Restores the defaults, though not the quality level, which was chosen for this machine. */
  reset(): void {
    this.update({ ...DEFAULT_SETTINGS, quality: this.data.quality, bindings: { ...DEFAULT_BINDINGS } });
  }

  onChange(listener: (data: SettingsData) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
