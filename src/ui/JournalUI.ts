import type { GameSession } from '../core/GameSession';
import { OBJECTIVES } from '../progression/content/objectives';
import { button, el, keyLabel } from './dom';
import { documentContent } from './DocumentUI';
import type { Screen } from './UIManager';

type Tab = 'objectives' | 'documents' | 'map';

const SVG_NS = 'http://www.w3.org/2000/svg';

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number>): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  return element;
}

export class JournalUI implements Screen {
  readonly root: HTMLElement;
  private body = el('div', 'journal-body');
  private tabs = el('div', 'journal-tabs');
  private tab: Tab = 'objectives';
  private docId: string | null = null;
  private floor: 0 | -14 = 0;

  constructor(
    private session: GameSession,
    private closeKey: string,
    private playSound: (name: string) => void,
    private onClose_: () => void,
  ) {
    this.floor = session.room().floorY === 0 ? 0 : -14;
    this.root = el('div', 'screen overlay-screen');
    const panel = el('div', 'panel journal-panel');
    panel.append(
      el('div', 'panel-header', [el('h2', 'panel-title', 'Journal'), this.tabs]),
      this.body,
      el('div', 'panel-footer', [
        el('span', 'key-hint', [el('span', 'keycap', keyLabel(closeKey)), 'Close']),
        button('text-button', 'Close', () => this.onClose_()),
      ]),
    );
    this.root.append(panel);
    const docs = session.journal.discovered;
    this.docId = docs[docs.length - 1] ?? null;
    this.render();
  }

  onKey(code: string): boolean {
    if (code === this.closeKey) {
      this.onClose_();
      return true;
    }
    return false;
  }

  private setTab(tab: Tab): void {
    this.tab = tab;
    this.playSound('ui:select');
    this.render();
  }

  private render(): void {
    const labels: [Tab, string][] = [
      ['objectives', 'Objective'],
      ['documents', 'Documents'],
      ['map', 'Map'],
    ];
    this.tabs.replaceChildren(
      ...labels.map(([tab, label]) => {
        const element = el('button', `journal-tab${this.tab === tab ? ' active' : ''}`, label, { type: 'button' });
        element.addEventListener('click', () => this.setTab(tab));
        return element;
      }),
    );
    if (this.tab === 'objectives') this.renderObjectives();
    else if (this.tab === 'documents') this.renderDocuments();
    else this.renderMap();
  }

  private renderObjectives(): void {
    const { objectives, playtime } = this.session;
    const pane = el('div', 'doc-pane', [
      el('div', 'label', 'Current objective'),
      el('p', 'objective-now', objectives.text),
      el('div', 'label', 'Done'),
      el('div', '', objectives.completed.length ? [...objectives.completed].reverse().map((id) => el('div', 'objective-done', OBJECTIVES[id] ?? '')) : [el('div', 'post-empty', 'Nothing yet.')]),
    ]);
    pane.dataset.time = String(playtime);
    this.body.replaceChildren(pane);
  }

  private renderDocuments(): void {
    const docs = this.session.journal.documents;
    const list = el(
      'div',
      'doc-list',
      docs.map((doc) => {
        const row = el('button', `doc-row${doc.id === this.docId ? ' active' : ''}`, [doc.title, el('small', '', doc.source)], { type: 'button' });
        row.addEventListener('click', () => {
          this.docId = doc.id;
          this.playSound('paper');
          this.renderDocuments();
        });
        return row;
      }),
    );
    const current = docs.find((doc) => doc.id === this.docId) ?? docs[0];
    const pane = el(
      'div',
      'doc-pane',
      current ? [el('div', 'document-view', [el('h2', 'doc-title', current.title), el('div', 'label doc-source', current.source), documentContent(current)])] : [],
    );
    this.body.replaceChildren(list, pane);
  }

  /** Draws the map straight from the level data, so that it can never disagree with the world. */
  private renderMap(): void {
    const { session } = this;
    const hasPlan = session.check({ flag: 'has_map' });
    const floor = this.floor;
    const rooms = session.level.rooms.filter(
      (room) => room.floorY === floor && (room.id !== 'forecourt' || session.visited.has('forecourt')) && (hasPlan || session.visited.has(room.id)),
    );

    const pane = el('div', 'map-pane');
    const controls = el('div', 'inv-actions', [
      button('text-button', 'Ground Floor', () => {
        this.floor = 0;
        this.playSound('ui:select');
        this.renderMap();
      }),
      button('text-button', 'Level C', () => {
        this.floor = -14;
        this.playSound('ui:select');
        this.renderMap();
      }),
      el('span', 'key-hint', hasPlan ? 'Floor plan from the records room' : 'Only showing where you have been. A floor plan might help.'),
    ]);
    controls.style.alignItems = 'center';
    (controls.children[floor === 0 ? 0 : 1] as HTMLElement).style.borderColor = 'var(--accent)';

    const map = svg('svg', { class: 'map-svg', preserveAspectRatio: 'xMidYMid meet' });
    if (rooms.length > 0) {
      const minX = Math.min(...rooms.map((room) => room.rect[0])) - 2;
      const minZ = Math.min(...rooms.map((room) => room.rect[1])) - 2;
      const maxX = Math.max(...rooms.map((room) => room.rect[2])) + 2;
      const maxZ = Math.max(...rooms.map((room) => room.rect[3])) + 2;
      map.setAttribute('viewBox', `${minX} ${minZ} ${maxX - minX} ${maxZ - minZ}`);

      for (const room of rooms) {
        const [x0, z0, x1, z1] = room.rect;
        const visited = session.visited.has(room.id);
        const current = session.currentRoom === room.id;
        map.append(
          svg('rect', {
            class: `map-room${visited ? ' visited' : ''}${current ? ' current' : ''}`,
            x: x0,
            y: z0,
            width: x1 - x0,
            height: z1 - z0,
          }),
        );
        if (x1 - x0 > 5 && z1 - z0 > 2.6) {
          const label = svg('text', { class: 'map-label', x: (x0 + x1) / 2, y: (z0 + z1) / 2 + 0.3 });
          label.textContent = room.name.replace(', Level C', '');
          map.append(label);
        }
      }

      for (const door of session.level.doors) {
        const a = session.room(door.a);
        if (a.floorY !== floor || !rooms.includes(a)) continue;
        const [x0, z0, x1, z1] = a.rect;
        const px = door.side === 'n' || door.side === 's' ? door.at : door.side === 'e' ? x1 + 0.15 : x0 - 0.15;
        const pz = door.side === 'e' || door.side === 'w' ? door.at : door.side === 'n' ? z0 - 0.15 : z1 + 0.15;
        const open = session.unlockedDoors.has(door.id) || door.lock.type === 'none';
        map.append(svg('circle', { cx: px, cy: pz, r: 0.34, fill: open ? '#58b07f' : '#c2452e' }));
      }

      if (session.room().floorY === floor) {
        map.append(svg('circle', { cx: session.playerPos[0], cy: session.playerPos[2], r: 0.46, fill: '#f6efe2' }));
      }
    }
    pane.append(controls, map);
    this.body.replaceChildren(pane);
  }
}
