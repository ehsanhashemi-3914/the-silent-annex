import type { GameSession } from '../core/GameSession';
import { INVENTORY_CAPACITY } from '../inventory/InventorySystem';
import { ItemDatabase } from '../inventory/ItemDatabase';
import type { ItemDef } from '../inventory/Item';
import { button, el, keyLabel } from './dom';
import type { Screen } from './UIManager';

export interface InventoryHost {
  session(): GameSession;
  icon(itemId: string): string;
  /** Shows the item's 3D model turning behind the transparent centre of the screen. */
  showInspector(itemId: string | null): void;
  rotateInspector(dx: number, dy: number): void;
  openDocument(docId: string): void;
  playSound(name: string): void;
  say(text: string): void;
  closeKey: string;
  onClose(): void;
}

const KIND_LABEL: Record<ItemDef['kind'], string> = {
  key: 'Key',
  puzzle: 'Part',
  consumable: 'Supply',
  document: 'Paper',
};

export class InventoryUI implements Screen {
  readonly root: HTMLElement;
  private grid = el('div', 'inventory-grid');
  private details = el('div', 'inv-details');
  private selected = 0;
  private dragging = false;
  private listeners: (() => void)[] = [];

  constructor(private host: InventoryHost) {
    this.root = el('div', 'screen inventory-screen');
    const left = el('div', '', [
      el('h2', 'panel-title', 'Inventory'),
      el('div', 'label', `${INVENTORY_CAPACITY} slots`),
      this.grid,
    ]);
    const center = el('div');
    center.style.cursor = 'grab';
    const right = el('div', '', [this.details]);
    right.style.display = 'flex';
    right.style.flexDirection = 'column';
    right.style.justifyContent = 'flex-end';
    this.root.append(left, center, right);

    // Dragging anywhere in the middle of the screen turns the item over.
    center.addEventListener('mousedown', () => {
      this.dragging = true;
      center.style.cursor = 'grabbing';
    });
    const move = (event: MouseEvent) => {
      if (this.dragging) this.host.rotateInspector(event.movementX, event.movementY);
    };
    const up = () => {
      this.dragging = false;
      center.style.cursor = 'grab';
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    this.listeners.push(() => window.removeEventListener('mousemove', move), () => window.removeEventListener('mouseup', up));
  }

  onOpen(): void {
    const items = this.host.session().inventory.items;
    const first = items.findIndex((id) => id !== null);
    this.selected = first < 0 ? 0 : first;
    this.render();
  }

  onClose(): void {
    this.host.showInspector(null);
    for (const off of this.listeners) off();
    this.listeners = [];
  }

  onKey(code: string): boolean {
    if (code === this.host.closeKey) {
      this.host.onClose();
      return true;
    }
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 };
    if (code in step) {
      this.selected = (this.selected + step[code] + INVENTORY_CAPACITY) % INVENTORY_CAPACITY;
      this.host.playSound('ui:hover');
      this.render();
      return true;
    }
    if (code === 'Enter') {
      this.useSelected();
      return true;
    }
    return false;
  }

  private useSelected(): void {
    const session = this.host.session();
    const id = session.inventory.items[this.selected];
    if (!id) return;
    const result = session.useItem(id);
    if (result.docId) {
      this.host.playSound('paper');
      this.host.openDocument(result.docId);
      return;
    }
    if (result.used) this.host.playSound('battery');
    else this.host.playSound('ui:error');
    if (result.text) this.host.say(result.text);
    this.render();
  }

  private render(): void {
    const session = this.host.session();
    const items = session.inventory.items;

    this.grid.replaceChildren(
      ...items.map((id, index) => {
        const slot = el('button', `inv-slot${id ? '' : ' empty'}${index === this.selected ? ' selected' : ''}`, undefined, {
          type: 'button',
          'aria-label': id ? (ItemDatabase.get(id)?.name ?? '') : 'Empty slot',
        });
        if (id) {
          const item = ItemDatabase.get(id) as ItemDef;
          slot.append(el('img', '', undefined, { src: this.host.icon(id), alt: item.name, draggable: false }), el('span', 'inv-kind', KIND_LABEL[item.kind]));
        }
        slot.addEventListener('click', () => {
          this.selected = index;
          this.host.playSound('ui:select');
          this.render();
        });
        slot.addEventListener('dblclick', () => this.useSelected());
        return slot;
      }),
    );

    const id = items[this.selected];
    const item = id ? ItemDatabase.get(id) : undefined;
    this.host.showInspector(id ?? null);

    const battery = el('div', 'battery-readout', [
      el('div', 'label', `Torch ${Math.round(session.battery)}%`),
      (() => {
        const bar = el('div', 'battery-bar');
        const fill = el('div');
        fill.style.width = `${session.battery}%`;
        bar.append(fill);
        return bar;
      })(),
    ]);

    const close = el('div', 'key-hint', [el('span', 'keycap', keyLabel(this.host.closeKey)), 'Close  ']);
    close.style.marginTop = '16px';

    if (!item) {
      this.details.replaceChildren(el('div', 'label', 'Empty slot'), battery, close);
      return;
    }
    const canUse = item.kind === 'consumable' || item.kind === 'document';
    const actionLabel = item.kind === 'document' ? 'Read' : 'Use';
    this.details.replaceChildren(
      el('div', 'label', KIND_LABEL[item.kind]),
      el('h3', 'inv-name', item.name),
      el('p', 'inv-description', item.description),
      el('div', 'inv-actions', canUse ? [button('text-button', actionLabel, () => this.useSelected())] : [el('span', 'key-hint', 'Used automatically where it fits. Drag to turn it over.')]),
      battery,
      close,
    );
  }
}

/** The pneumatic post: moves items between the bag and shared storage. */
export class PostUI implements Screen {
  readonly root: HTMLElement;
  private body = el('div', 'post-columns');

  constructor(
    private session: () => GameSession,
    private playSound: (name: string) => void,
    private onClose_: () => void,
  ) {
    this.root = el('div', 'screen overlay-screen');
    const panel = el('div', 'panel');
    panel.append(
      el('div', 'panel-header', [el('h2', 'panel-title', 'Pneumatic Post'), el('span', 'label', 'Internal. All stations.')]),
      el('div', 'panel-body', [
        el('p', 'inv-description', "Whatever goes in here comes out of any other station in the building. It's still working, and I'd rather not think about who's been emptying it."),
        this.body,
      ]),
      el('div', 'panel-footer', [el('span', 'key-hint'), button('text-button', 'Close', () => this.onClose_())]),
    );
    this.root.append(panel);
    this.render();
  }

  private render(): void {
    const { inventory } = this.session();
    const carried = inventory.items
      .map((id, index) => ({ id, index }))
      .filter((entry): entry is { id: string; index: number } => entry.id !== null);

    const left = carried.length
      ? carried.map(({ id, index }) => this.row(id, 'Send', () => inventory.sendToStorage(index)))
      : [el('div', 'post-empty', 'Nothing carried.')];
    const right = inventory.storage.length
      ? inventory.storage.map((id, index) => this.row(id, 'Take', () => inventory.takeFromStorage(index)))
      : [el('div', 'post-empty', 'The station is empty.')];

    this.body.replaceChildren(
      el('div', '', [el('div', 'label', `Carried ${carried.length}/${INVENTORY_CAPACITY}`), el('div', 'post-list', left)]),
      el('div', '', [el('div', 'label', 'In the post'), el('div', 'post-list', right)]),
    );
  }

  private row(id: string, verb: string, act: () => boolean): HTMLElement {
    const item = ItemDatabase.get(id) as ItemDef;
    const row = el('button', 'post-row', [item.name, el('span', '', verb)], { type: 'button', 'data-nav': true });
    row.addEventListener('click', () => {
      if (act()) this.playSound('post:thunk');
      else this.playSound('ui:error');
      this.render();
    });
    return row;
  }
}
