import { DOCUMENTS, type DocumentDef } from '../progression/content/documents';
import { button, el, keyLabel } from './dom';
import type { Screen } from './UIManager';

/** Builds the sheet of paper, terminal or tape transcript for a document. */
export function documentContent(doc: DocumentDef): HTMLElement {
  const sheet = el('div', `doc-sheet style-${doc.style}`);
  if (doc.style === 'tape') {
    const wave = el('div', 'tape-wave');
    for (let i = 0; i < 46; i++) {
      const bar = el('i');
      bar.style.setProperty('--h', `${6 + ((i * 37) % 20)}px`);
      bar.style.animationDelay = `${(i * 0.13) % 1.1}s`;
      wave.append(bar);
    }
    sheet.append(el('div', 'tape-reels', [el('div', 'tape-reel'), wave, el('div', 'tape-reel')]));
  }
  sheet.append(el('div', '', doc.body));
  return sheet;
}

export class DocumentUI implements Screen {
  readonly root: HTMLElement;

  constructor(
    docId: string,
    private closeKey: string,
    private onClose_: () => void,
  ) {
    const doc = DOCUMENTS[docId];
    this.root = el('div', 'screen overlay-screen');
    const panel = el('div', 'panel');
    panel.style.width = 'min(760px, 100%)';
    const view = el('div', 'document-view', [
      el('h2', 'doc-title', doc.title),
      el('div', 'label doc-source', doc.source),
      documentContent(doc),
    ]);
    const body = el('div', 'panel-body', [view]);
    body.tabIndex = -1;
    panel.append(
      body,
      el('div', 'panel-footer', [
        el('span', 'key-hint', [el('span', 'keycap', keyLabel(closeKey)), 'Close']),
        button('text-button', 'Close', () => this.onClose_()),
      ]),
    );
    this.root.append(panel);
  }

  onKey(code: string): boolean {
    if (code === this.closeKey || code === 'Enter') {
      this.onClose_();
      return true;
    }
    return false;
  }
}
