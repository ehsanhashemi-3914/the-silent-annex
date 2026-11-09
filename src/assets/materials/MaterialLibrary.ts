// One shared material per surface type. Everything that looks like painted steel uses
// the same object, so the renderer can batch geometry and the GPU compiles few shaders.

import * as THREE from 'three';
import { fbm } from '../procedural/Noise';
import { createTextureSet, type TextureKey, type TextureSet } from '../procedural/TextureFactory';
import type { MaterialId } from '../../world/LevelDefinition';

export type LibraryMaterialId = MaterialId | 'fabricOrange' | 'fabricDark' | 'skin' | 'hair' | 'fur' | 'listener';

interface MaterialDef {
  texture?: TextureKey;
  /** Metres covered by one repeat of the texture. */
  tile?: number;
  color?: number;
  roughness?: number;
  metalness?: number;
  /** Strength of the large-scale dirt added on top, which hides visible tiling. */
  grime?: number;
  normalScale?: number;
  transparent?: boolean;
  opacity?: number;
  envMapIntensity?: number;
}

const DEFS: Record<LibraryMaterialId, MaterialDef> = {
  concreteBoard: { texture: 'concreteBoard', tile: 2.4, grime: 0.55 },
  concreteSmooth: { texture: 'concreteSmooth', tile: 2.6, grime: 0.5 },
  concreteDark: { texture: 'concreteDark', tile: 2.6, grime: 0.45 },
  plasterPale: { texture: 'plasterPale', tile: 2, grime: 0.6 },
  paintSeafoam: { texture: 'paintSeafoam', tile: 1.8, grime: 0.55 },
  paintOchre: { texture: 'paintOchre', tile: 2, grime: 0.6 },
  paintGrey: { texture: 'paintGrey', tile: 2, grime: 0.5 },
  terrazzo: { texture: 'terrazzo', tile: 1.6, grime: 0.4, envMapIntensity: 1.3 },
  lino: { texture: 'lino', tile: 1.2, grime: 0.5, envMapIntensity: 0.9 },
  carpet: { texture: 'carpet', tile: 1.4, grime: 0.55, normalScale: 0.7 },
  rubberFloor: { texture: 'rubberFloor', tile: 0.8, grime: 0.4 },
  grating: { texture: 'grating', tile: 0.6, metalness: 0.7, grime: 0.2 },
  ceilingTile: { texture: 'ceilingTile', tile: 1.2, grime: 0.35 },
  snow: { texture: 'snow', tile: 3.5, grime: 0 },
  rock: { texture: 'rock', tile: 4, grime: 0.3 },
  wood: { texture: 'wood', tile: 1, grime: 0.2 },
  woodDark: { texture: 'woodDark', tile: 1.1, grime: 0.3 },
  metalPainted: { texture: 'metalPainted', tile: 1, metalness: 0.25, grime: 0.3 },
  metalGreen: { texture: 'metalGreen', tile: 1, metalness: 0.25, grime: 0.3 },
  metalDark: { texture: 'metalDark', tile: 1, metalness: 0.45, grime: 0.2 },
  metalBrushed: { texture: 'metalBrushed', tile: 0.8, metalness: 0.9, envMapIntensity: 1.4 },
  rust: { texture: 'rust', tile: 1, metalness: 0.3 },
  brass: { texture: 'brass', tile: 0.6, metalness: 0.95, envMapIntensity: 1.6 },
  steelBlue: { texture: 'steelBlue', tile: 1, metalness: 0.3, grime: 0.3 },
  plastic: { texture: 'plastic', tile: 0.6 },
  plasticBeige: { texture: 'plasticBeige', tile: 0.6, grime: 0.15 },
  rubber: { texture: 'rubber', tile: 0.5 },
  foam: { texture: 'foam', tile: 0.8, normalScale: 0.6 },
  fabric: { texture: 'fabric', tile: 0.35 },
  fabricGreen: { texture: 'fabricGreen', tile: 0.35, grime: 0.2 },
  fabricOrange: { texture: 'fabricOrange', tile: 0.26, normalScale: 0.8 },
  fabricDark: { texture: 'fabricDark', tile: 0.26, normalScale: 0.8 },
  leather: { texture: 'leather', tile: 0.5 },
  paper: { texture: 'paper', tile: 0.4 },
  cardboard: { texture: 'cardboard', tile: 0.5, grime: 0.2 },
  hazard: { texture: 'hazard', tile: 1, grime: 0.3 },
  redPaint: { texture: 'redPaint', tile: 0.8, metalness: 0.2 },
  plant: { texture: 'plant', tile: 0.4 },
  glass: { color: 0x9fb8b4, roughness: 0.08, metalness: 0, transparent: true, opacity: 0.13, envMapIntensity: 2 },
  glassFrosted: { color: 0x74827c, roughness: 0.7, metalness: 0, transparent: true, opacity: 0.72, envMapIntensity: 0.6 },
  glassDark: { color: 0x10181a, roughness: 0.1, metalness: 0, transparent: true, opacity: 0.42, envMapIntensity: 2.2 },
  skin: { color: 0xc49a80, roughness: 0.66 },
  hair: { color: 0x1a1412, roughness: 0.8 },
  fur: { color: 0x8e8474, roughness: 1 },
  listener: { color: 0x030304, roughness: 0.92, metalness: 0, envMapIntensity: 0 },
};

/**
 * Adds world-space dirt to a standard material by patching its shader. Sampling a
 * large noise texture by world position means no two metres of wall look identical,
 * which is the main thing that stops repeating textures from looking repeated.
 */
function addWorldGrime(material: THREE.MeshStandardMaterial, grimeTexture: THREE.Texture, strength: number): void {
  const uniforms = { grimeTexture: { value: grimeTexture }, grimeStrength: { value: strength } };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.grimeTexture = uniforms.grimeTexture;
    shader.uniforms.grimeStrength = uniforms.grimeStrength;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGrimePos;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        {
          vec4 grimeWorld = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            grimeWorld = instanceMatrix * grimeWorld;
          #endif
          vGrimePos = (modelMatrix * grimeWorld).xyz;
        }`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vGrimePos;\nuniform sampler2D grimeTexture;\nuniform float grimeStrength;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        {
          vec2 grimeUv = vGrimePos.xz * 0.11 + vGrimePos.y * vec2(0.083, 0.131);
          float large = texture2D(grimeTexture, grimeUv).r;
          float small = texture2D(grimeTexture, grimeUv * 4.3).g;
          float dirt = smoothstep(0.32, 0.78, large * 0.72 + small * 0.28);
          diffuseColor.rgb *= 1.0 - grimeStrength * 0.55 * dirt;
        }`,
      );
  };
  // Materials sharing this patch can share a compiled program.
  material.customProgramCacheKey = () => 'world-grime';
}

export class MaterialLibrary {
  private materials = new Map<LibraryMaterialId, THREE.MeshStandardMaterial>();
  private textures = new Map<TextureKey, TextureSet>();
  private grimeTexture: THREE.DataTexture;
  private owned: { dispose(): void }[] = [];
  private custom = new Map<string, THREE.Material>();

  constructor(
    private textureSize: number,
    private anisotropy: number,
  ) {
    this.grimeTexture = this.createGrimeTexture();
    this.owned.push(this.grimeTexture);
  }

  private createGrimeTexture(): THREE.DataTexture {
    const size = 256;
    const large = fbm(size, { period: 4, octaves: 6, persistence: 0.58, seed: 901 });
    const small = fbm(size, { period: 8, octaves: 5, persistence: 0.6, seed: 902 });
    const data = new Uint8Array(size * size * 4);
    for (let i = 0; i < size * size; i++) {
      data[i * 4] = large[i] * 255;
      data[i * 4 + 1] = small[i] * 255;
      data[i * 4 + 2] = 0;
      data[i * 4 + 3] = 255;
    }
    const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }

  /** All material ids, so the loading screen can create them ahead of time and report progress. */
  get ids(): LibraryMaterialId[] {
    return Object.keys(DEFS) as LibraryMaterialId[];
  }

  private textureSet(key: TextureKey): TextureSet {
    let set = this.textures.get(key);
    if (!set) {
      set = createTextureSet(key, this.textureSize);
      for (const texture of [set.map, set.normalMap, set.roughnessMap]) {
        texture.anisotropy = this.anisotropy;
        this.owned.push(texture);
      }
      this.textures.set(key, set);
    }
    return set;
  }

  get(id: LibraryMaterialId): THREE.MeshStandardMaterial {
    let material = this.materials.get(id);
    if (material) return material;

    const def = DEFS[id];
    material = new THREE.MeshStandardMaterial({
      color: def.color ?? 0xffffff,
      roughness: def.roughness ?? 1,
      metalness: def.metalness ?? 0,
      vertexColors: true,
      transparent: def.transparent ?? false,
      opacity: def.opacity ?? 1,
      envMapIntensity: def.envMapIntensity ?? 0.6,
      depthWrite: !(def.transparent ?? false),
    });

    if (def.texture) {
      const set = this.textureSet(def.texture);
      const repeat = 1 / (def.tile ?? 1);
      // Clones share the image data but can have their own repeat setting.
      const map = set.map.clone();
      const normalMap = set.normalMap.clone();
      const roughnessMap = set.roughnessMap.clone();
      for (const texture of [map, normalMap, roughnessMap]) {
        texture.repeat.set(repeat, repeat);
        texture.needsUpdate = true;
        this.owned.push(texture);
      }
      material.map = map;
      material.normalMap = normalMap;
      material.roughnessMap = roughnessMap;
      material.normalScale.setScalar(def.normalScale ?? 1);
    }
    if (def.grime) addWorldGrime(material, this.grimeTexture, def.grime);

    this.materials.set(id, material);
    this.owned.push(material);
    return material;
  }

  /** Shares a one-off material (a sign, a screen) under a name, creating it on first use. */
  customMaterial<T extends THREE.Material>(key: string, create: () => T): T {
    let material = this.custom.get(key) as T | undefined;
    if (!material) {
      material = create();
      this.custom.set(key, material);
      this.owned.push(material);
    }
    return material;
  }

  /** Lets callers hand over textures and materials made elsewhere, to be disposed of together. */
  track<T extends { dispose(): void }>(resource: T): T {
    this.owned.push(resource);
    return resource;
  }

  dispose(): void {
    for (const resource of this.owned) resource.dispose();
    this.owned = [];
    this.materials.clear();
    this.custom.clear();
    this.textures.clear();
  }
}
