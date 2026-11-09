// A tiny separate 3D scene for turning an item over in the inventory, and for rendering
// its icons. It borrows the main renderer, so materials are shared rather than duplicated.

import * as THREE from 'three';
import { createItemModel } from '../assets/geometry/ItemModels';
import type { MaterialLibrary } from '../assets/materials/MaterialLibrary';
import { ItemDatabase } from '../inventory/ItemDatabase';

const ICON_SIZE = 192;

export class ItemInspector {
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
  private pivot = new THREE.Group();
  private models = new Map<string, THREE.Group>();
  private icons = new Map<string, string>();
  private current: THREE.Group | null = null;
  private rotation = new THREE.Vector2(0.4, 0.4);
  private velocity = 0.25;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private materials: MaterialLibrary,
  ) {
    this.scene.add(this.pivot);
    const key = new THREE.DirectionalLight(0xfff0dc, 3.6);
    key.position.set(1.4, 2, 2);
    const rim = new THREE.DirectionalLight(0x90b4d0, 2.2);
    rim.position.set(-2, 0.4, -1.4);
    const fill = new THREE.HemisphereLight(0xcfd8d4, 0x2a2622, 1.1);
    this.scene.add(key, rim, fill);
    this.camera.position.set(0, 0, 1);
  }

  private modelFor(itemId: string): THREE.Group {
    let model = this.models.get(itemId);
    if (!model) {
      const item = ItemDatabase.get(itemId);
      model = createItemModel(item?.model ?? 'battery', this.materials);
      // Every item fills the frame the same way, however large it really is.
      const size = new THREE.Box3().setFromObject(model).getSize(new THREE.Vector3()).length();
      model.scale.setScalar(0.3 / Math.max(0.01, size));
      this.models.set(itemId, model);
    }
    return model;
  }

  /** Renders one item into a data URL for use as an inventory icon. */
  icon(itemId: string): string {
    const cached = this.icons.get(itemId);
    if (cached) return cached;
    const target = new THREE.WebGLRenderTarget(ICON_SIZE, ICON_SIZE, { colorSpace: THREE.SRGBColorSpace });
    const model = this.modelFor(itemId);
    this.pivot.clear();
    this.pivot.add(model);
    this.pivot.rotation.set(0.5, 0.65, 0);

    const clearColor = new THREE.Color();
    this.renderer.getClearColor(clearColor);
    const clearAlpha = this.renderer.getClearAlpha();
    const previousTarget = this.renderer.getRenderTarget();
    const previousTone = this.renderer.toneMapping;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setRenderTarget(target);
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);

    const pixels = new Uint8Array(ICON_SIZE * ICON_SIZE * 4);
    this.renderer.readRenderTargetPixels(target, 0, 0, ICON_SIZE, ICON_SIZE, pixels);
    this.renderer.setRenderTarget(previousTarget);
    this.renderer.setClearColor(clearColor, clearAlpha);
    this.renderer.toneMapping = previousTone;
    target.dispose();

    const canvas = document.createElement('canvas');
    canvas.width = ICON_SIZE;
    canvas.height = ICON_SIZE;
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const image = ctx.createImageData(ICON_SIZE, ICON_SIZE);
    // Pixels read from the GPU come out upside-down.
    for (let y = 0; y < ICON_SIZE; y++) {
      const from = (ICON_SIZE - 1 - y) * ICON_SIZE * 4;
      image.data.set(pixels.subarray(from, from + ICON_SIZE * 4), y * ICON_SIZE * 4);
    }
    ctx.putImageData(image, 0, 0);
    const url = canvas.toDataURL('image/png');
    this.icons.set(itemId, url);
    this.pivot.clear();
    return url;
  }

  show(itemId: string | null): void {
    this.pivot.clear();
    this.current = itemId ? this.modelFor(itemId) : null;
    if (this.current) this.pivot.add(this.current);
    this.rotation.set(0.4, 0.4);
    this.velocity = 0.25;
  }

  get active(): boolean {
    return this.current !== null;
  }

  rotate(dx: number, dy: number): void {
    this.rotation.y += dx * 0.012;
    this.rotation.x = Math.max(-1.4, Math.min(1.4, this.rotation.x + dy * 0.012));
    this.velocity = 0;
  }

  render(dt: number, width: number, height: number): void {
    if (!this.current) return;
    this.rotation.y += this.velocity * dt;
    this.pivot.rotation.set(this.rotation.x, this.rotation.y, 0);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const previousTone = this.renderer.toneMapping;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.setRenderTarget(null);
    // The inspector has no post-processing, so its own tone mapping has to run here.
    this.renderer.clear();
    this.renderer.render(this.scene, this.camera);
    this.renderer.toneMapping = previousTone;
  }

  dispose(): void {
    this.pivot.clear();
    for (const model of this.models.values()) {
      model.traverse((node) => {
        if (node instanceof THREE.Mesh) node.geometry.dispose();
      });
    }
    this.models.clear();
    this.icons.clear();
  }
}
