import * as THREE from 'three';
import { el, keyLabel } from '../ui/dom';

const tempVector = new THREE.Vector3();

/** The "[E] Open door" label, placed on screen next to the thing it refers to. */
export class InteractionPrompt {
  readonly root: HTMLElement;
  private keycap = el('span', 'keycap');
  private text = el('span');
  private currentText = '';

  constructor() {
    this.root = el('div', 'hud-prompt', [this.keycap, this.text]);
    this.root.style.opacity = '0';
  }

  show(text: string, blocked: boolean, keyCode: string, worldPosition: THREE.Vector3, camera: THREE.Camera): void {
    if (text !== this.currentText) {
      this.currentText = text;
      this.text.textContent = text;
    }
    this.keycap.textContent = keyLabel(keyCode);
    this.root.classList.toggle('blocked', blocked);
    this.root.style.opacity = '1';

    tempVector.copy(worldPosition).project(camera);
    // Kept within the middle of the screen, since an object can sit near the edge of view.
    const x = Math.max(0.14, Math.min(0.72, tempVector.x * 0.5 + 0.5));
    const y = Math.max(0.2, Math.min(0.78, 0.5 - tempVector.y * 0.5));
    this.root.style.transform = `translate(${(x * window.innerWidth + 16).toFixed(0)}px, ${(y * window.innerHeight).toFixed(0)}px)`;
  }

  hide(): void {
    this.root.style.opacity = '0';
    this.currentText = '';
  }
}
