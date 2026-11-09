// Small 3D models of the things the player can carry. The same model appears in the
// world, on the inventory icon and in the rotating inspection view.

import * as THREE from 'three';
import type { LibraryMaterialId, MaterialLibrary } from '../materials/MaterialLibrary';
import { PropBuilder } from './PropBuilder';
import { mergeAndDispose } from './PropBuilder';

type ModelFn = (b: PropBuilder) => void;

function keyShape(b: PropBuilder, metal: LibraryMaterialId, bowRadius: number): void {
  b.torus(bowRadius, bowRadius * 0.28, -0.055, 0, 0, metal, { segments: 16 });
  b.box(0.082, 0.009, 0.006, 0.006, 0, 0, metal);
  b.box(0.012, 0.013, 0.006, 0.04, -0.008, 0, metal);
  b.box(0.008, 0.01, 0.006, 0.026, -0.007, 0, metal);
}

const MODELS: Record<string, ModelFn> = {
  battery: (b) => {
    b.box(0.09, 0.1, 0.09, 0, 0.05, 0, 'steelBlue');
    b.box(0.092, 0.03, 0.092, 0, 0.055, 0, 'plasticBeige');
    for (const x of [-0.025, 0.025]) b.cylinder(0.006, 0.006, 0.018, x, 0.108, 0, 'metalBrushed', { segments: 6 });
    b.torus(0.012, 0.0022, 0.025, 0.12, 0, 'metalBrushed', { segments: 10 });
  },
  keyBrass: (b) => {
    keyShape(b, 'brass', 0.022);
    b.box(0.05, 0.03, 0.001, -0.1, -0.03, 0, 'paper', { rz: 0.5 });
  },
  keySteel: (b) => {
    keyShape(b, 'metalBrushed', 0.02);
    b.torus(0.024, 0.003, -0.058, 0, 0, 'redPaint', { segments: 14, ry: 0.5 });
  },
  keyBarrel: (b) => {
    b.cylinder(0.008, 0.008, 0.1, 0.02, 0, 0, 'brass', { rz: Math.PI / 2, segments: 10 });
    b.cylinder(0.018, 0.018, 0.014, -0.03, 0, 0, 'brass', { rz: Math.PI / 2, segments: 12 });
    b.torus(0.021, 0.006, -0.058, 0, 0, 'brass', { segments: 14 });
    b.box(0.014, 0.02, 0.005, 0.058, -0.012, 0, 'brass');
  },
  card: (b) => {
    b.box(0.086, 0.054, 0.0014, 0, 0, 0, 'plasticBeige');
    b.box(0.026, 0.032, 0.0006, -0.024, 0.002, 0.001, 'rust');
    b.box(0.03, 0.004, 0.0006, 0.018, 0.012, 0.001, 'plastic');
    b.box(0.03, 0.004, 0.0006, 0.018, 0.003, 0.001, 'plastic');
    b.box(0.086, 0.009, 0.0006, 0, -0.019, 0.001, 'redPaint');
  },
  fuse: (b) => {
    b.cylinder(0.018, 0.018, 0.09, 0, 0, 0, 'plasticBeige', { rz: Math.PI / 2, segments: 14 });
    for (const x of [-0.05, 0.05]) b.cylinder(0.021, 0.021, 0.024, x, 0, 0, 'brass', { rz: Math.PI / 2, segments: 14 });
    b.cylinder(0.0186, 0.0186, 0.012, 0.012, 0, 0, 'metalGreen', { rz: Math.PI / 2, segments: 14 });
  },
  notebook: (b) => {
    b.box(0.11, 0.015, 0.16, 0, 0.0075, 0, 'paper');
    b.box(0.114, 0.003, 0.164, 0, 0.016, 0, 'leather');
    b.box(0.114, 0.003, 0.164, 0, 0, 0, 'leather');
    b.box(0.006, 0.018, 0.164, -0.057, 0.008, 0, 'leather');
    b.box(0.006, 0.002, 0.12, 0.03, 0.018, 0, 'redPaint');
  },
  reel: (b) => {
    b.cylinder(0.11, 0.11, 0.004, 0, 0.012, 0, 'metalBrushed', { segments: 26 });
    b.cylinder(0.11, 0.11, 0.004, 0, -0.012, 0, 'metalBrushed', { segments: 26 });
    b.cylinder(0.086, 0.086, 0.02, 0, 0, 0, 'plastic', { segments: 26 });
    b.cylinder(0.028, 0.028, 0.03, 0, 0, 0, 'plasticBeige', { segments: 16 });
    b.box(0.05, 0.001, 0.016, 0, 0.0145, 0.06, 'paper');
  },
};

/** Builds a self-contained model of an item, centred on the origin. */
export function createItemModel(model: string, materials: MaterialLibrary): THREE.Group {
  const builder = new PropBuilder(materials);
  (MODELS[model] ?? MODELS.battery)(builder);
  const group = new THREE.Group();
  for (const [material, geometries] of builder.parts) {
    const merged = mergeAndDispose(geometries);
    if (merged) group.add(new THREE.Mesh(merged, materials.get(material)));
  }
  const bounds = new THREE.Box3().setFromObject(group);
  const center = bounds.getCenter(new THREE.Vector3());
  for (const child of group.children) child.position.sub(center);
  return group;
}
