import * as THREE from 'three';
import type { QualityLevel } from '../core/Settings';

export interface QualityProfile {
  textureSize: number;
  anisotropy: number;
  shadowMapSize: number;
  keyShadow: boolean;
  pointLights: number;
  spotLights: number;
  maxPixelRatio: number;
  msaa: number;
  /** Redraw the torch's shadows every Nth frame. A shadow that's a frame late is hard to see. */
  torchShadowInterval: number;
  bloom: boolean;
  ambientOcclusion: boolean;
  dustCount: number;
  snowCount: number;
}

export const QUALITY_PROFILES: Record<QualityLevel, QualityProfile> = {
  low: {
    textureSize: 256,
    anisotropy: 2,
    shadowMapSize: 512,
    keyShadow: false,
    pointLights: 3,
    spotLights: 1,
    maxPixelRatio: 1,
    msaa: 0,
    torchShadowInterval: 3,
    bloom: false,
    ambientOcclusion: false,
    dustCount: 120,
    snowCount: 800,
  },
  medium: {
    textureSize: 512,
    anisotropy: 4,
    shadowMapSize: 1024,
    keyShadow: true,
    pointLights: 4,
    spotLights: 2,
    maxPixelRatio: 1,
    msaa: 2,
    torchShadowInterval: 2,
    bloom: true,
    ambientOcclusion: false,
    dustCount: 240,
    snowCount: 1800,
  },
  high: {
    textureSize: 1024,
    anisotropy: 8,
    shadowMapSize: 1536,
    keyShadow: true,
    pointLights: 6,
    spotLights: 2,
    maxPixelRatio: 1.5,
    msaa: 4,
    torchShadowInterval: 1,
    bloom: true,
    ambientOcclusion: true,
    dustCount: 400,
    snowCount: 3200,
  },
};

/**
 * Picks a starting quality from the name of the graphics chip, for players who haven't
 * chosen one. It's only a first guess: dynamic resolution then adapts to real performance.
 */
export function suggestQuality(): QualityLevel {
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    if (!gl) return 'low';
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const name = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    if (/swiftshader|llvmpipe|software|microsoft basic/i.test(name)) return 'low';
    if (/intel|uhd|iris|mali|adreno|powervr/i.test(name)) return 'medium';
    return 'high';
  } catch {
    return 'medium';
  }
}

const SLOW_FRAME = 1 / 42;
const FAST_FRAME = 1 / 75;
const MIN_DYNAMIC_SCALE = 0.6;

/** Owns the WebGL context and the canvas it draws into. */
export class Renderer {
  readonly three: THREE.WebGLRenderer;
  private renderScale = 1;
  private profile: QualityProfile;
  /** Lowered automatically when the game can't keep up, and raised again when it can. */
  private dynamicScale = 1;
  private frameAverage = 1 / 60;
  private settleTimer = 3;
  private dynamicLocked = false;

  constructor(
    readonly canvas: HTMLCanvasElement,
    quality: QualityLevel,
  ) {
    this.profile = QUALITY_PROFILES[quality];
    // Antialiasing happens on the post-processing target, not the screen buffer.
    this.three = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.three.shadowMap.enabled = true;
    this.three.shadowMap.type = THREE.PCFShadowMap;
    // Tone mapping and display conversion both happen in the final post-processing pass.
    this.three.toneMapping = THREE.NoToneMapping;
    this.three.outputColorSpace = THREE.SRGBColorSpace;
    this.applySize();
  }

  /** Fixes the resolution at a given scale, so that automated measurements are comparable. */
  lockDynamicScale(scale: number): void {
    this.dynamicLocked = true;
    this.dynamicScale = scale;
    this.applySize();
  }

  get width(): number {
    return window.innerWidth;
  }

  get height(): number {
    return window.innerHeight;
  }

  /** The actual number of pixels drawn: display size times the capped pixel ratio and render scale. */
  get pixelRatio(): number {
    return Math.min(window.devicePixelRatio || 1, this.profile.maxPixelRatio) * this.renderScale * this.dynamicScale;
  }

  /**
   * Dynamic resolution. Keeps a running average of frame time and, when it stays too
   * slow, draws fewer pixels. Returns true when the size changed, as render targets
   * must then be resized by the caller.
   */
  trackFrame(dt: number): boolean {
    // Very long frames mean the tab was throttled or hidden, not that the GPU is struggling.
    if (dt > 0.2 || this.dynamicLocked) return false;
    this.frameAverage += (dt - this.frameAverage) * 0.05;
    this.settleTimer -= dt;
    if (this.settleTimer > 0) return false;

    let next = this.dynamicScale;
    if (this.frameAverage > SLOW_FRAME) next = Math.max(MIN_DYNAMIC_SCALE, this.dynamicScale - 0.1);
    else if (this.frameAverage < FAST_FRAME) next = Math.min(1, this.dynamicScale + 0.05);
    if (next === this.dynamicScale) return false;

    this.dynamicScale = next;
    // Wait longer before trying to raise it again, so that the picture doesn't keep pumping.
    this.settleTimer = next < 1 ? 5 : 3;
    this.applySize();
    return true;
  }

  setQuality(quality: QualityLevel, renderScale: number): void {
    this.profile = QUALITY_PROFILES[quality];
    this.renderScale = renderScale;
    this.applySize();
  }

  applySize(): void {
    this.three.setPixelRatio(this.pixelRatio);
    this.three.setSize(this.width, this.height, true);
  }

  dispose(): void {
    this.three.dispose();
  }
}
