// A tiny helper for building interface elements in code, without a framework.

type Attributes = Record<string, string | number | boolean | undefined>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  content?: string | (Node | string)[],
  attributes?: Attributes,
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (typeof content === 'string') element.textContent = content;
  else if (content) element.append(...content);
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      if (value === undefined || value === false) continue;
      element.setAttribute(key, value === true ? '' : String(value));
    }
  }
  return element;
}

export function button(className: string, text: string, onClick: () => void, disabled = false): HTMLButtonElement {
  const element = el('button', className, text, { type: 'button', 'data-nav': true });
  element.disabled = disabled;
  element.addEventListener('click', onClick);
  return element;
}

const KEY_NAMES: Record<string, string> = {
  ShiftLeft: 'L Shift',
  ShiftRight: 'R Shift',
  ControlLeft: 'L Ctrl',
  ControlRight: 'R Ctrl',
  AltLeft: 'L Alt',
  AltRight: 'R Alt',
  Space: 'Space',
  Escape: 'Esc',
  Tab: 'Tab',
  Enter: 'Enter',
  Backspace: 'Bksp',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
};

/** Turns a code such as "KeyE" into the label a player expects to see, such as "E". */
export function keyLabel(code: string): string {
  if (KEY_NAMES[code]) return KEY_NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

export function formatTime(seconds: number): string {
  const total = Math.floor(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function formatDate(timestamp: number): string {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  return `${date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} ${date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
}
