// Loading screen, opening text cards and the ending sequences.

import { button, el, formatTime } from './dom';
import type { Screen } from './UIManager';

export class LoadingScreen {
  readonly root: HTMLElement;
  private bar = el('div');
  private note = el('div', 'loading-note');

  constructor() {
    const track = el('div', 'loading-bar');
    track.append(this.bar);
    this.root = el('div', 'screen loading-screen', [el('div', 'loading-title', 'The Silent Annex'), track, this.note]);
  }

  setProgress(fraction: number, note: string): void {
    this.bar.style.width = `${Math.round(fraction * 100)}%`;
    this.note.textContent = note;
  }

  showError(message: string): void {
    this.root.replaceChildren(el('div', 'loading-title', 'The Silent Annex'), el('div', 'fatal-message', message));
  }

  remove(): void {
    this.root.remove();
  }
}

export interface Card {
  small?: string;
  text: string;
  hold: number;
}

/**
 * A series of white-on-black text cards that plays automatically. A key press skips
 * forward. Since it sits on the screen stack, the game waits underneath it.
 */
export class CardSequence implements Screen {
  readonly root: HTMLElement;
  readonly dismissible = false;
  private text = el('div', 'card-text');
  private index = -1;
  private timer = 0;
  private finished = false;
  private skipLabel: HTMLElement;

  constructor(
    private cards: Card[],
    private onDone: () => void,
    private allowSkip = true,
  ) {
    this.skipLabel = el('div', 'card-skip', allowSkip ? 'Press any key to continue' : '');
    this.root = el('div', 'screen card-screen', [this.text, this.skipLabel]);
    this.root.addEventListener('click', () => this.advance());
    this.text.style.opacity = '0';
  }

  onOpen(): void {
    this.next();
  }

  onKey(): boolean {
    if (this.allowSkip) this.advance();
    return true;
  }

  update(dt: number): void {
    if (this.finished) return;
    this.timer -= dt;
    if (this.timer <= 0) this.next();
  }

  private advance(): void {
    if (this.allowSkip && !this.finished) this.next();
  }

  private next(): void {
    this.index++;
    if (this.index >= this.cards.length) {
      this.finished = true;
      this.onDone();
      return;
    }
    const card = this.cards[this.index];
    this.text.style.opacity = '0';
    this.timer = card.hold + 1.1;
    window.setTimeout(() => {
      this.text.replaceChildren(...(card.small ? [el('span', 'small', card.small)] : []), card.text);
      this.text.style.opacity = '1';
    }, this.index === 0 ? 50 : 520);
  }
}

export interface EndingStats {
  time: number;
  documents: number;
  documentsTotal: number;
  label: string;
}

export class EndingScreen implements Screen {
  readonly root: HTMLElement;
  readonly dismissible = false;

  constructor(title: string, lines: string[], stats: EndingStats, onExit: () => void) {
    this.root = el('div', 'screen card-screen');
    const text = el('div', 'card-text', [
      el('span', 'small', title),
      ...lines.map((line) => el('p', '', line)),
      el('div', 'ending-stats', [
        el('div', '', ['Time', el('b', '', formatTime(stats.time))]),
        el('div', '', ['Documents', el('b', '', `${stats.documents} of ${stats.documentsTotal}`)]),
        el('div', '', ['Ending', el('b', '', stats.label)]),
      ]),
    ]);
    const exit = button('text-button', 'Return to Title', onExit);
    exit.style.marginTop = '30px';
    text.append(exit);
    this.root.append(text);
  }
}
