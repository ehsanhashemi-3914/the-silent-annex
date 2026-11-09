// Ilse Marek, built entirely from code: an orange parka with a fur hood, and a field radio
// with a tall whip antenna rising over one shoulder. That silhouette matters to the story,
// so the same builder also makes the Listener by swapping every material for near-black.

import * as THREE from 'three';
import { mergeAndDispose, PropBuilder } from '../assets/geometry/PropBuilder';
import type { LibraryMaterialId, MaterialLibrary } from '../assets/materials/MaterialLibrary';
import { createRng } from '../assets/procedural/Noise';

export interface CharacterRig {
  root: THREE.Group;
  hips: THREE.Group;
  spine: THREE.Group;
  chest: THREE.Group;
  neck: THREE.Group;
  head: THREE.Group;
  skirt: THREE.Group;
  hipL: THREE.Group;
  hipR: THREE.Group;
  kneeL: THREE.Group;
  kneeR: THREE.Group;
  footL: THREE.Group;
  footR: THREE.Group;
  shoulderL: THREE.Group;
  shoulderR: THREE.Group;
  elbowL: THREE.Group;
  elbowR: THREE.Group;
  handR: THREE.Group;
  antenna: THREE.Group;
  /** Lengths of the leg bones, needed to solve where the knees go. */
  thighLength: number;
  shinLength: number;
  hipHeight: number;
}

function group(parent: THREE.Object3D, x: number, y: number, z: number): THREE.Group {
  const node = new THREE.Group();
  node.position.set(x, y, z);
  parent.add(node);
  return node;
}

/** Turns what a builder collected into meshes on a bone, with an optional material override. */
function bake(builder: PropBuilder, bone: THREE.Object3D, materials: MaterialLibrary, override?: THREE.Material): void {
  for (const [id, geometries] of builder.parts) {
    const merged = mergeAndDispose(geometries);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, override ?? materials.get(id as LibraryMaterialId));
    mesh.castShadow = true;
    mesh.receiveShadow = !override;
    bone.add(mesh);
  }
}

export function createCharacter(materials: MaterialLibrary, override?: THREE.Material): CharacterRig {
  const shape = (bone: THREE.Object3D, build: (b: PropBuilder) => void) => {
    const builder = new PropBuilder(materials);
    build(builder);
    bake(builder, bone, materials, override);
  };

  const thighLength = 0.44;
  const shinLength = 0.44;
  const hipHeight = 0.92;

  const root = new THREE.Group();
  const hips = group(root, 0, hipHeight, 0);
  const spine = group(hips, 0, 0.08, 0);
  const chest = group(spine, 0, 0.24, 0);

  // The parka's torso is a lathe, flaring at the hem and bulked out by its insulation.
  shape(spine, (b) => {
    b.lathe(
      [
        [0.002, 0.26],
        [0.178, 0.26],
        [0.178, 0.1],
        [0.176, -0.06],
        [0.002, -0.07],
      ],
      0,
      0,
      0,
      'fabricOrange',
      { segments: 14 },
    );
  });
  shape(chest, (b) => {
    b.lathe(
      [
        [0.002, 0.27],
        [0.09, 0.285],
        [0.14, 0.26],
        [0.19, 0.2],
        [0.2, 0.08],
        [0.185, -0.04],
        [0.002, -0.05],
      ],
      0,
      0,
      0,
      'fabricOrange',
      { segments: 14 },
    );
    // Reflective chest band and a storm flap down the front zip.
    b.cylinder(0.204, 0.2, 0.05, 0, 0.1, 0, 'plasticBeige', { segments: 14, open: true });
    b.box(0.05, 0.42, 0.02, 0, 0.1, -0.188, 'fabricDark');
    // Pockets (the character's front is toward -z, the way she walks).
    b.box(0.11, 0.09, 0.03, -0.1, 0.06, -0.178, 'fabricOrange', { ry: 0.3 });
    b.box(0.11, 0.09, 0.03, 0.1, 0.06, -0.178, 'fabricOrange', { ry: -0.3 });

    // Her pack, on her back at +z. The player looks at this for the whole game, so it has
    // to read clearly: a canvas pack with a steel field radio strapped to the outside.
    b.box(0.27, 0.38, 0.12, 0, 0.09, 0.25, 'fabricGreen');
    for (const side of [-1, 1]) b.cylinder(0.06, 0.06, 0.38, side * 0.135, 0.09, 0.25, 'fabricGreen', { segments: 8 });
    b.box(0.21, 0.13, 0.05, 0, -0.04, 0.325, 'fabricGreen');
    b.box(0.2, 0.012, 0.055, 0, 0.02, 0.326, 'rubber');
    b.cylinder(0.052, 0.052, 0.34, 0, 0.32, 0.25, 'fabricDark', { rz: Math.PI / 2, segments: 9 });
    for (const side of [-1, 1]) b.torus(0.055, 0.007, side * 0.09, 0.32, 0.25, 'rubber', { ry: Math.PI / 2, segments: 10 });

    // The radio set itself: an olive steel case with a dial, a meter and two knobs.
    b.box(0.23, 0.18, 0.07, 0, 0.16, 0.335, 'metalGreen');
    b.box(0.235, 0.012, 0.075, 0, 0.255, 0.335, 'metalDark');
    b.box(0.09, 0.05, 0.004, -0.055, 0.2, 0.372, 'plasticBeige');
    b.box(0.003, 0.038, 0.005, -0.04, 0.2, 0.374, 'redPaint', { rz: -0.4 });
    b.cylinder(0.03, 0.03, 0.016, 0.06, 0.19, 0.375, 'metalBrushed', { rx: Math.PI / 2, segments: 12 });
    b.cylinder(0.014, 0.014, 0.018, -0.07, 0.125, 0.375, 'plastic', { rx: Math.PI / 2, segments: 8 });
    b.cylinder(0.014, 0.014, 0.018, -0.03, 0.125, 0.375, 'plastic', { rx: Math.PI / 2, segments: 8 });
    // A telephone-style handset clipped to one side.
    b.box(0.032, 0.13, 0.042, -0.17, 0.08, 0.3, 'plastic');
    // Webbing around the case.
    for (const side of [-1, 1]) b.box(0.02, 0.2, 0.082, side * 0.085, 0.16, 0.335, 'rubber');

    // Shoulder straps.
    for (const side of [-1, 1]) {
      b.box(0.045, 0.34, 0.02, side * 0.11, 0.1, -0.19, 'rubber');
      b.box(0.045, 0.02, 0.28, side * 0.11, 0.27, 0.05, 'rubber');
    }
  });

  // The whip antenna, on its own bone so it can sway. This is the silhouette the staff described.
  const antenna = group(chest, 0.092, 0.26, 0.335);
  shape(antenna, (b) => {
    b.cylinder(0.008, 0.012, 0.09, 0, 0.04, 0, 'metalDark', { segments: 6 });
    b.cylinder(0.0028, 0.005, 1.15, 0, 0.66, 0, 'metalBrushed', { segments: 5 });
    b.sphere(0.009, 0, 1.24, 0, 'metalDark', { segments: 6 });
  });

  // Fur-trimmed hood, thrown back behind the head.
  shape(chest, (b) => {
    const rng = createRng(7);
    b.sphere(0.135, 0, 0.3, 0.1, 'fabricOrange', { scaleX: 1.15, scaleY: 0.75, scaleZ: 1, segments: 12 });
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      b.sphere(
        0.04 + rng() * 0.02,
        Math.cos(angle) * 0.14,
        0.31 + Math.sin(angle) * 0.08,
        0.015 + Math.abs(Math.sin(angle)) * 0.06,
        'fur',
        { segments: 5, scaleY: 0.8 },
      );
    }
  });

  const neck = group(chest, 0, 0.28, 0);
  const head = group(neck, 0, 0.1, -0.01);
  shape(neck, (b) => {
    b.cylinder(0.05, 0.058, 0.1, 0, 0.03, 0, 'skin', { segments: 8 });
    // A scarf wound at the throat.
    b.torus(0.075, 0.042, 0, 0.0, 0, 'fabricGreen', { rx: Math.PI / 2, segments: 12 });
    b.box(0.07, 0.16, 0.02, 0.05, -0.08, -0.1, 'fabricGreen', { rx: 0.2 });
  });
  shape(head, (b) => {
    b.sphere(0.097, 0, 0.08, 0, 'skin', { scaleY: 1.14, scaleZ: 1.02, segments: 14 });
    b.box(0.04, 0.03, 0.03, 0, 0.055, -0.1, 'skin');
    for (const side of [-1, 1]) {
      b.sphere(0.01, side * 0.036, 0.09, -0.09, 'hair', { segments: 5 });
      b.sphere(0.018, side * 0.096, 0.07, 0.005, 'skin', { segments: 6, scaleZ: 1.5 });
    }
    // Short dark hair tied back, under a wool cap.
    b.sphere(0.103, 0, 0.1, 0.012, 'hair', { scaleY: 1.1, scaleZ: 1.06, segments: 12 });
    b.sphere(0.107, 0, 0.14, 0.006, 'fabricDark', { scaleY: 0.86, segments: 12 });
    b.cylinder(0.106, 0.11, 0.05, 0, 0.1, 0.006, 'fabricDark', { segments: 14 });
    b.sphere(0.044, 0, 0.055, 0.1, 'hair', { segments: 8 });
  });

  // Skirt of the parka: a separate bone, swaying a little as she walks.
  const skirt = group(hips, 0, 0.02, 0);
  shape(skirt, (b) => {
    b.lathe(
      [
        [0.002, 0.04],
        [0.18, 0.04],
        [0.2, -0.1],
        [0.225, -0.23],
        [0.002, -0.23],
      ],
      0,
      0,
      0,
      'fabricOrange',
      { segments: 14 },
    );
    b.cylinder(0.228, 0.229, 0.04, 0, -0.2, 0, 'fabricDark', { segments: 14, open: true });
  });

  // Legs
  const leg = (side: number) => {
    const hip = group(hips, side * 0.095, -0.02, 0);
    shape(hip, (b) => {
      b.sphere(0.078, 0, 0, 0, 'fabricDark', { segments: 8 });
      b.cylinder(0.078, 0.066, thighLength, 0, -thighLength / 2, 0, 'fabricDark', { segments: 10, open: true });
      b.box(0.05, 0.12, 0.09, side * 0.07, -thighLength * 0.55, 0, 'fabricDark');
    });
    const knee = group(hip, 0, -thighLength, 0);
    shape(knee, (b) => {
      b.sphere(0.066, 0, 0, 0, 'fabricDark', { segments: 8 });
      b.cylinder(0.064, 0.052, shinLength, 0, -shinLength / 2, 0, 'fabricDark', { segments: 10 });
      // Gaiter over the top of the boot.
      b.cylinder(0.062, 0.058, 0.17, 0, -shinLength + 0.08, 0, 'rubber', { segments: 10 });
    });
    const foot = group(knee, 0, -shinLength, 0);
    shape(foot, (b) => {
      b.box(0.1, 0.075, 0.26, 0, -0.03, -0.05, 'leather');
      b.sphere(0.056, 0, -0.03, -0.16, 'leather', { scaleY: 0.72, segments: 8 });
      b.box(0.105, 0.022, 0.285, 0, -0.068, -0.05, 'rubber');
      b.cylinder(0.054, 0.056, 0.05, 0, 0.0, 0.03, 'leather', { segments: 8 });
    });
    return { hip, knee, foot };
  };
  const left = leg(-1);
  const right = leg(1);

  // Arms
  const arm = (side: number) => {
    const shoulder = group(chest, side * 0.218, 0.2, 0);
    shape(shoulder, (b) => {
      b.sphere(0.085, 0, 0, 0, 'fabricOrange', { segments: 9 });
      b.cylinder(0.075, 0.062, 0.3, 0, -0.15, 0, 'fabricOrange', { segments: 9 });
    });
    const elbow = group(shoulder, 0, -0.3, 0);
    shape(elbow, (b) => {
      b.sphere(0.062, 0, 0, 0, 'fabricOrange', { segments: 8 });
      b.cylinder(0.06, 0.05, 0.27, 0, -0.135, 0, 'fabricOrange', { segments: 9 });
      b.cylinder(0.053, 0.053, 0.05, 0, -0.25, 0, 'fabricDark', { segments: 9, open: true });
      // Glove.
      b.sphere(0.05, 0, -0.31, 0, 'rubber', { scaleY: 1.2, scaleX: 0.84, segments: 8 });
    });
    return { shoulder, elbow };
  };
  const armL = arm(-1);
  const armR = arm(1);

  // The right hand holds the torch, which stays attached when the light goes off.
  const handR = group(armR.elbow, 0, -0.31, 0);
  // The torch continues the line of the forearm, so that it points wherever the arm does.
  shape(handR, (b) => {
    b.cylinder(0.022, 0.02, 0.17, 0, -0.06, 0, 'metalDark', { segments: 9 });
    b.cylinder(0.026, 0.036, 0.04, 0, -0.165, 0, 'metalBrushed', { segments: 10 });
  });

  return {
    root,
    hips,
    spine,
    chest,
    neck,
    head,
    skirt,
    hipL: left.hip,
    hipR: right.hip,
    kneeL: left.knee,
    kneeR: right.knee,
    footL: left.foot,
    footR: right.foot,
    shoulderL: armL.shoulder,
    shoulderR: armR.shoulder,
    elbowL: armL.elbow,
    elbowR: armR.elbow,
    handR,
    antenna,
    thighLength,
    shinLength,
    hipHeight,
  };
}
