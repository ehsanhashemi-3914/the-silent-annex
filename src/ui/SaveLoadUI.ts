import { SAVE_SLOTS, type SaveManager, type SaveSlot } from '../saving/SaveManager';
import { button, el, formatDate, formatTime } from './dom';
import type { Screen } from './UIManager';

const SLOT_NAMES: Record<SaveSlot, string> = {
  auto: 'Autosave',
  slot1: 'Log 1',
  slot2: 'Log 2',
  slot3: 'Log 3',
};

export class SaveLoadUI implements Screen {
  readonly root: HTMLElement;

  /** In save mode, the autosave slot is hidden. In load mode, empty slots are disabled. */
  constructor(
    mode: 'save' | 'load',
    saves: SaveManager,
    onChoose: (slot: SaveSlot) => void,
    onBack: () => void,
  ) {
    this.root = el('div', 'screen overlay-screen');
    const panel = el('div', 'panel');
    panel.style.width = 'min(640px, 100%)';
    const slots = mode === 'save' ? SAVE_SLOTS.filter((slot) => slot !== 'auto') : SAVE_SLOTS;
    const summaries = saves.list();

    const rows = slots.map((slot) => {
      const summary = summaries.find((entry) => entry.slot === slot);
      const row = el('button', 'slot', [
        el('span', 'slot-name', SLOT_NAMES[slot]),
        el('span', 'slot-place', summary ? summary.label : 'Empty'),
        el('span', 'slot-meta', summary ? `${formatDate(summary.savedAt)} · ${formatTime(summary.playtime)}` : ''),
      ], { type: 'button', 'data-nav': true });
      row.disabled = mode === 'load' && !summary;
      row.addEventListener('click', () => onChoose(slot));
      return row;
    });

    panel.append(
      el('div', 'panel-header', [
        el('h2', 'panel-title', mode === 'save' ? 'Record a Log' : 'Load Game'),
        el('span', 'label', mode === 'save' ? 'Dictation recorder' : ''),
      ]),
      el('div', 'panel-body', [el('div', 'slot-list', rows)]),
      el('div', 'panel-footer', [el('span', 'key-hint'), button('text-button', 'Back', onBack)]),
    );
    this.root.append(panel);
  }
}
