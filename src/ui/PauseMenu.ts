import { button, el } from './dom';
import type { Screen } from './UIManager';

export interface PauseActions {
  resume(): void;
  inventory(): void;
  journal(): void;
  load(): void;
  settings(): void;
  quit(): void;
}

export class PauseMenu implements Screen {
  readonly root: HTMLElement;

  constructor(actions: PauseActions) {
    this.root = el('div', 'screen menu-screen');
    this.root.append(
      el('h2', 'game-title', [el('small', '', 'Paused'), 'The Silent Annex']),
      el('div', 'signal-line'),
      el('nav', 'menu-list', [
        button('menu-item', 'Resume', () => actions.resume()),
        button('menu-item', 'Inventory', () => actions.inventory()),
        button('menu-item', 'Journal', () => actions.journal()),
        button('menu-item', 'Load Game', () => actions.load()),
        button('menu-item', 'Settings', () => actions.settings()),
        button('menu-item', 'Quit to Title', () => actions.quit()),
      ]),
    );
  }
}

/** Asks before doing something that would lose progress. */
export class ConfirmScreen implements Screen {
  readonly root: HTMLElement;

  constructor(message: string, confirmLabel: string, onConfirm: () => void, onCancel: () => void) {
    this.root = el('div', 'screen overlay-screen');
    const panel = el('div', 'panel');
    panel.style.width = 'min(520px, 100%)';
    panel.append(
      el('div', 'panel-body', [el('p', 'inv-description', message)]),
      el('div', 'panel-footer', [button('text-button', 'Cancel', onCancel), button('text-button', confirmLabel, onConfirm)]),
    );
    this.root.append(panel);
  }
}
