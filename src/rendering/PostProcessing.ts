// The final look of the game. The 3D scene is first drawn to an off-screen image, and
// that image then runs through a chain of full-screen effects before it reaches the display.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import type { QualityProfile } from './Renderer';

/** Bloom is a soft blur anyway, so it loses nothing by working at half resolution, and costs a quarter. */
class HalfResolutionBloom extends UnrealBloomPass {
  override setSize(width: number, height: number): void {
    super.setSize(Math.max(2, Math.round(width / 2)), Math.max(2, Math.round(height / 2)));
  }
}

/**
 * The cinematic grade, doing everything in one full-screen pass so that it costs as
 * little as possible: tone mapping, then a teal-and-amber colour balance, vignette, film
 * grain and a touch of lens fringing, and finally conversion for the display. `silence`
 * drains the colour during a Hush, so the picture goes quiet along with the sound.
 */
const CinemaShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    time: { value: 0 },
    brightness: { value: 1 },
    silence: { value: 0 },
    fade: { value: 0 },
    damage: { value: 0 },
    exposure: { value: 1.05 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float time;
    uniform float brightness;
    uniform float silence;
    uniform float fade;
    uniform float damage;
    uniform float exposure;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 37.0) * 43758.5453);
    }

    // A compact fit of the ACES film curve: it rolls bright lights off gently, as film does.
    vec3 filmicCurve(vec3 x) {
      return clamp((x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
    }

    vec3 toDisplay(vec3 c) {
      return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(0.0031308, c));
    }

    void main() {
      vec2 centered = vUv - 0.5;
      float dist = dot(centered, centered);

      // Lens fringing grows toward the corners, and when something is wrong.
      float fringe = 0.0064 * dist + silence * 0.0014 + damage * 0.006;
      vec3 color = vec3(
        texture2D(tDiffuse, vUv + centered * fringe).r,
        texture2D(tDiffuse, vUv).g,
        texture2D(tDiffuse, vUv - centered * fringe).b
      );

      color = toDisplay(filmicCurve(color * exposure * 0.6)) * brightness;

      // Split toning: cold shadows, warm highlights.
      float luma = dot(color, vec3(0.2126, 0.7152, 0.0722));
      color *= mix(vec3(0.86, 1.02, 1.06), vec3(1.05, 1.0, 0.92), smoothstep(0.05, 0.6, luma));

      // A gentle contrast curve around middle grey.
      color = mix(vec3(luma), color, 1.05 - silence * 0.72);
      color = pow(max(color, vec3(0.0)), vec3(1.05));

      // Vignette, which closes in during a Hush.
      float vignette = smoothstep(0.82 - silence * 0.2, 0.18 - silence * 0.08, dist * 1.75);
      color *= mix(0.4, 1.0, vignette);

      // Film grain, stronger in the shadows, the way real film stock behaves.
      float grain = hash(vUv * vec2(1920.0, 1080.0)) - 0.5;
      color += grain * mix(0.05, 0.016, smoothstep(0.0, 0.5, luma)) * (1.0 + damage * 8.0);

      // White noise overlay for being caught by the Listener.
      if (damage > 0.0) {
        float staticNoise = hash(floor(vUv * vec2(640.0, 360.0)));
        color = mix(color, vec3(staticNoise), smoothstep(0.2, 1.0, damage));
      }

      color *= 1.0 - fade;
      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export class PostProcessing {
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private bloom: UnrealBloomPass | null = null;
  private ao: GTAOPass | null = null;
  private cinema: ShaderPass;
  private target: THREE.WebGLRenderTarget;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera, profile: QualityProfile, width: number, height: number) {
    // A high-precision target keeps bright lights above 1.0 until the tone-mapping step,
    // which is what lets them bloom realistically.
    this.target = new THREE.WebGLRenderTarget(width, height, {
      type: THREE.HalfFloatType,
      samples: profile.msaa,
    });
    this.composer = new EffectComposer(renderer, this.target);
    this.renderPass = new RenderPass(scene, camera);
    this.composer.addPass(this.renderPass);

    if (profile.ambientOcclusion) {
      this.ao = new GTAOPass(scene, camera, width, height);
      this.ao.blendIntensity = 0.85;
      this.ao.updateGtaoMaterial({ radius: 0.42, distanceExponent: 1.4, thickness: 1.2, scale: 1.1, samples: 12 });
      this.composer.addPass(this.ao);
    }
    if (profile.bloom) {
      this.bloom = new HalfResolutionBloom(new THREE.Vector2(width, height), 0.42, 0.72, 0.92);
      this.composer.addPass(this.bloom);
    }

    this.cinema = new ShaderPass(CinemaShader);
    this.composer.addPass(this.cinema);
  }

  set brightness(value: number) {
    this.cinema.uniforms.brightness.value = value;
  }

  /** 0 for normal, 1 for the fully drained look of a Hush. */
  set silence(value: number) {
    this.cinema.uniforms.silence.value = value;
  }

  /** Fades the whole picture to black, independently of the HTML overlays. */
  set fade(value: number) {
    this.cinema.uniforms.fade.value = value;
  }

  /** Burst of static, used when the Listener catches the player. */
  set damage(value: number) {
    this.cinema.uniforms.damage.value = value;
  }

  setSize(width: number, height: number, pixelRatio: number): void {
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
  }

  render(time: number, dt: number): void {
    this.cinema.uniforms.time.value = time % 1000;
    this.composer.render(dt);
  }

  dispose(): void {
    this.bloom?.dispose();
    this.ao?.dispose();
    this.composer.dispose();
    this.target.dispose();
  }
}
