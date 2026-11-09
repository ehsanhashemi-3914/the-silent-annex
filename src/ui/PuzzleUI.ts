// The hardware panels the player works with. Each one is only a view: the rules live in
// the puzzle classes, and these panels call them and then show the result.

import type { GameSession } from '../core/GameSession';
import type { PuzzleId } from '../core/Script';
import { DIAL_COUNT } from '../puzzles/ArchivePuzzle';
import { BREAKERS, type BreakerId } from '../puzzles/ElectricalPuzzle';
import { button, el } from './dom';
import type { Screen } from './UIManager';

export interface PuzzleHostUI {
  session(): GameSession;
  playSound(name: string): void;
  close(): void;
  /** Lets a successful solve linger for a moment before the panel goes away. */
  closeAfter(seconds: number): void;
}

function deviceFrame(title: string, subtitle: string, content: Node[], host: PuzzleHostUI, extraClass = ''): HTMLElement {
  const root = el('div', 'screen overlay-screen');
  const device = el('div', `device ${extraClass}`);
  device.append(
    el('div', 'device-title', [el('span', '', title), el('span', '', subtitle)]),
    ...content,
    el('div', 'device-footer', [el('span', 'key-hint', 'Esc to step away'), button('text-button', 'Step Away', () => host.close())]),
  );
  root.append(device);
  return root;
}

export class KeypadUI implements Screen {
  readonly root: HTMLElement;
  private entry = '';
  private display = el('div', 'keypad-display');
  private solvedAlready = false;

  constructor(
    private puzzleId: 'records_keypad' | 'director_safe',
    private host: PuzzleHostUI,
  ) {
    const puzzle = this.puzzle;
    const keys = el('div', 'keypad-keys');
    for (const key of ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', 'E']) {
      const element = el('button', 'hw-key', key, { type: 'button' });
      element.addEventListener('click', () => this.press(key));
      keys.append(element);
    }
    this.root = deviceFrame(puzzle.title, 'Four digits', [this.display, keys], host, 'keypad-device');
    this.refresh();
  }

  private get puzzle() {
    const { puzzles } = this.host.session();
    return this.puzzleId === 'records_keypad' ? puzzles.recordsKeypad : puzzles.directorSafe;
  }

  private refresh(): void {
    const length = this.puzzle.length;
    this.display.textContent = this.entry.padEnd(length, '–');
  }

  private press(key: string): void {
    if (this.solvedAlready) return;
    if (key === 'C') {
      this.entry = '';
      this.host.playSound('keypad:beep');
    } else if (key === 'E') {
      this.submit();
      return;
    } else if (this.entry.length < this.puzzle.length) {
      this.entry += key;
      this.host.playSound('keypad:beep');
    }
    this.refresh();
    if (this.entry.length === this.puzzle.length) this.submit();
  }

  private submit(): void {
    if (this.entry.length < this.puzzle.length) return;
    const ok = this.host.session().puzzles.enterCode(this.puzzleId, this.entry);
    this.entry = ok ? this.entry : '';
    if (ok) {
      this.solvedAlready = true;
      this.display.classList.add('ok');
      this.display.textContent = 'OPEN';
      this.host.closeAfter(0.8);
      return;
    }
    this.host.playSound('keypad:bad');
    this.display.textContent = 'ERR';
    window.setTimeout(() => this.refresh(), 600);
  }

  onKey(code: string): boolean {
    const digit = code.startsWith('Digit') ? code.slice(5) : code.startsWith('Numpad') ? code.slice(6) : null;
    if (digit && /^\d$/.test(digit)) {
      this.press(digit);
      return true;
    }
    if (code === 'Backspace') {
      this.entry = this.entry.slice(0, -1);
      this.refresh();
      return true;
    }
    if (code === 'Enter') {
      this.submit();
      return true;
    }
    return false;
  }
}

const BREAKER_INFO: Record<BreakerId, { name: string; tag: string }> = {
  main: { name: 'MAIN', tag: 'Incoming feed' },
  west: { name: 'WEST BUS', tag: 'DO NOT CLOSE: dead short. K.A.' },
  east: { name: 'EAST BUS', tag: 'Research wing, lift' },
  reserve: { name: 'RESERVE', tag: 'Valley line. No supply.' },
};

export class ElectricalUI implements Screen {
  readonly root: HTMLElement;
  private breakers = new Map<BreakerId, { toggle: HTMLButtonElement; state: HTMLElement }>();
  private socket = el('div', 'fuse-socket');
  private fuseAction = el('div');
  private status = el('div', 'device-status');

  constructor(private host: PuzzleHostUI) {
    const board = el('div', 'board-row');
    for (const id of BREAKERS) {
      const info = BREAKER_INFO[id];
      const toggle = el('button', 'breaker-switch', undefined, { type: 'button', 'aria-label': info.name });
      toggle.addEventListener('click', () => {
        this.host.session().puzzles.toggleBreaker(id);
        this.host.playSound('switch:toggle');
        this.refresh();
      });
      const state = el('div', 'breaker-state');
      this.breakers.set(id, { toggle, state });
      board.append(el('div', 'breaker', [el('div', 'breaker-name', info.name), el('div', 'breaker-tag', info.tag), toggle, state]));
    }
    const lever = el('button', 'big-lever', 'ENERGISE', { type: 'button' });
    lever.addEventListener('click', () => this.energise());
    const row = el('div', 'fuse-row', [el('span', '', 'SOCKET F3 (30A)'), this.socket, this.fuseAction]);
    const leverRow = el('div', '', [lever]);
    leverRow.style.textAlign = 'right';
    leverRow.style.marginTop = '18px';
    this.root = deviceFrame('Distribution Board 2', 'Research wing', [row, board, leverRow, this.status], host);
    this.status.textContent = host.session().puzzles.electrical.solved ? 'BOARD LIVE. EAST BUS LOAD NORMAL.' : 'BOARD DEAD. NO LOAD.';
    this.refresh();
  }

  private energise(): void {
    const result = this.host.session().puzzles.energise();
    if (result === 'solved') {
      this.status.classList.remove('fault');
      this.status.textContent = 'BOARD LIVE. EAST BUS LOAD NORMAL.';
      this.host.closeAfter(1.2);
    } else {
      this.status.classList.add('fault');
      const messages = {
        'no-fuse': 'NO CONTINUITY: F3 OPEN',
        short: 'TRIP: DEAD SHORT ON WEST BUS',
        backfeed: 'TRIP: BACKFEED, MAIN AND RESERVE BOTH CLOSED',
        'no-feed': 'NO INCOMING SUPPLY',
        'no-load': 'MAIN LIVE. NO LOAD ON ANY BUS',
      };
      this.status.textContent = messages[result];
      this.host.playSound(result === 'short' || result === 'backfeed' ? 'spark' : 'relay:clunk');
    }
    this.refresh();
  }

  private refresh(): void {
    const { puzzles, inventory } = this.host.session();
    const { electrical } = puzzles;
    for (const [id, parts] of this.breakers) {
      const on = electrical.breakers[id];
      parts.toggle.classList.toggle('on', on);
      parts.state.textContent = on ? 'CLOSED' : 'OPEN';
    }
    this.socket.classList.toggle('fitted', electrical.fuseSeated);
    if (electrical.fuseSeated) {
      this.fuseAction.replaceChildren(el('span', '', 'Seated'));
    } else {
      const fit = button('text-button', inventory.has('fuse_30a') ? 'Fit Fuse' : 'No Fuse', () => {
        if (puzzles.seatFuse()) this.host.playSound('relay:clunk');
        this.refresh();
      }, !inventory.has('fuse_30a'));
      this.fuseAction.replaceChildren(fit);
    }
  }
}

export class ArchiveUI implements Screen {
  readonly root: HTMLElement;
  private faces: HTMLElement[] = [];
  private status = el('div', 'device-status');

  constructor(private host: PuzzleHostUI) {
    const row = el('div', 'dial-row');
    for (let i = 0; i < DIAL_COUNT; i++) {
      const face = el('div', 'dial-face');
      this.faces.push(face);
      const up = el('button', '', '▲', { type: 'button', 'aria-label': `Dial ${i + 1} up` });
      const down = el('button', '', '▼', { type: 'button', 'aria-label': `Dial ${i + 1} down` });
      up.addEventListener('click', () => this.rotate(i, -1));
      down.addEventListener('click', () => this.rotate(i, 1));
      row.append(el('div', 'dial', [up, face, down]));
      if (i === 0 || i === 2) row.append(el('span', 'dial-sep', '/'));
    }
    const caption = el('div', 'dial-caption', [el('span', '', 'SERIES'), el('span', '', 'TEST No.'), el('span', '', 'TIME OF RECORDING')]);
    const lever = el('button', 'big-lever', 'RETRIEVE', { type: 'button' });
    lever.addEventListener('click', () => this.pull());
    const leverRow = el('div', '', [lever]);
    leverRow.style.textAlign = 'center';
    leverRow.style.marginTop = '18px';
    this.status.textContent = 'ENTER CALL NUMBER.';
    this.root = deviceFrame('Archive Retrieval', 'Level C', [row, caption, leverRow, this.status], host);
    this.refresh();
  }

  private rotate(index: number, direction: 1 | -1): void {
    this.host.session().puzzles.rotateDial(index, direction);
    this.host.playSound('switch:toggle');
    this.refresh();
  }

  private pull(): void {
    this.host.playSound('lever:pull');
    const ok = this.host.session().puzzles.pullArchiveLever();
    if (ok) {
      this.status.classList.remove('fault');
      this.status.textContent = 'ITEM LOCATED. RELEASING DOOR.';
      this.host.closeAfter(1.4);
    } else {
      this.status.classList.add('fault');
      this.status.textContent = 'NO SUCH ITEM.';
      this.host.playSound('keypad:bad');
    }
  }

  private refresh(): void {
    const { archive } = this.host.session().puzzles;
    this.faces.forEach((face, i) => {
      face.textContent = archive.label(i);
    });
  }
}

const FAULT_TEXT: Record<string, string> = {
  'no-key': 'IGNITION: NO KEY',
  'no-power': 'NO SUPPLY ON THIS CIRCUIT',
  'fault-overtemp': 'FAULT: GENERATOR JACKET OVERTEMP. SYSTEM TRIPPED.',
  'fault-airflow': 'FAULT: AIRFLOW AT DAMPERS. SYSTEM TRIPPED.',
  'fault-no-power': 'FAULT: DAMPER MOTORS HAVE NO SUPPLY. SYSTEM TRIPPED.',
  'fault-unsealed': 'INTERLOCK: CHAMBER UNSEALED. SYSTEM TRIPPED.',
};

export class CentralUI implements Screen {
  readonly root: HTMLElement;
  private list = el('div');
  private status = el('div', 'device-status');

  constructor(private host: PuzzleHostUI) {
    const { central } = host.session().puzzles;
    this.status.textContent = central.solved ? 'DOOR INTERLOCK RELEASED.' : central.generator ? 'GENERATOR RUNNING.' : 'ANNEX SYSTEMS OFFLINE.';
    this.root = deviceFrame('Annex Systems', 'Security control', [this.list, this.status], host);
    this.refresh();
  }

  private operate(control: 'generator' | 'ventilation' | 'dampers' | 'release'): void {
    const { puzzles } = this.host.session();
    const result = puzzles.operateCentral(control);
    if (result === 'ok') {
      this.host.playSound(control === 'generator' ? 'power:restore' : 'relay:clunk');
      this.status.classList.remove('fault');
      const messages = {
        generator: 'GENERATOR RUNNING. CHAMBER FANS RUNNING.',
        ventilation: puzzles.central.ventilation ? 'CHAMBER FANS RUNNING.' : 'CHAMBER FANS STOPPED.',
        dampers: 'DAMPERS SEATED. CHAMBER SEALED.',
        release: 'DOOR INTERLOCK RELEASED.',
      };
      this.status.textContent = messages[control];
      if (control === 'release') this.host.closeAfter(1.6);
    } else {
      this.status.classList.add('fault');
      this.status.textContent = FAULT_TEXT[result] ?? 'FAULT.';
      this.host.playSound(result.startsWith('fault') ? 'spark' : 'keypad:bad');
    }
    this.refresh();
  }

  private row(lamp: string, name: string, sub: string, control: HTMLElement): HTMLElement {
    return el('div', 'system-row', [el('div', `lamp ${lamp}`), el('div', '', [el('div', 'system-name', name), el('div', 'system-sub', sub)]), control]);
  }

  private action(label: string, onClick: () => void, disabled = false): HTMLButtonElement {
    const element = el('button', 'system-button', label, { type: 'button' });
    element.disabled = disabled;
    element.addEventListener('click', onClick);
    return element;
  }

  private refresh(): void {
    const { puzzles, inventory } = this.host.session();
    const c = puzzles.central;
    this.list.replaceChildren(
      this.row(c.coolant ? 'on' : '', 'COOLANT', 'Hand valve, Level C corridor', el('span', 'system-sub', c.coolant ? 'FLOWING' : 'NO FLOW')),
      this.row(
        c.keyInserted ? 'on' : '',
        'IGNITION KEY',
        c.keyInserted ? 'Key turned' : 'Held by the Director',
        this.action(
          inventory.has('ignition_key') && !c.keyInserted ? 'Insert Key' : c.keyInserted ? 'Inserted' : 'No Key',
          () => {
            if (puzzles.insertIgnitionKey()) this.host.playSound('relay:clunk');
            this.refresh();
          },
          c.keyInserted || !inventory.has('ignition_key'),
        ),
      ),
      this.row(c.generator ? 'on' : '', 'DEEP GENERATOR', c.generator ? 'Running' : 'Stopped', this.action('Start', () => this.operate('generator'), c.generator)),
      this.row(
        c.ventilation ? 'warn' : '',
        'CHAMBER FANS',
        c.ventilation ? 'Running' : 'Stopped',
        this.action(c.ventilation ? 'Stop Fans' : 'Start Fans', () => this.operate('ventilation')),
      ),
      this.row(c.dampers ? 'on' : '', 'ACOUSTIC DAMPERS', c.dampers ? 'Seated' : 'Open', this.action('Seat', () => this.operate('dampers'), c.dampers)),
      this.row(c.solved ? 'on' : 'alert', 'ANNEX DOOR', c.solved ? 'Released' : 'Interlock holding', this.action('Release', () => this.operate('release'), c.solved)),
    );
  }
}

export function createPuzzleScreen(id: PuzzleId, host: PuzzleHostUI): Screen {
  switch (id) {
    case 'records_keypad':
    case 'director_safe':
      return new KeypadUI(id, host);
    case 'electrical':
      return new ElectricalUI(host);
    case 'archive':
      return new ArchiveUI(host);
    case 'central':
      return new CentralUI(host);
  }
}
