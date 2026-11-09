// Everything hanging in the air: drifting dust, blowing snow, and the sky outside. The
// particles are moved entirely in their vertex shader, so thousands of them cost almost
// no CPU time at all, and they allocate nothing per frame.

import * as THREE from 'three';
import type { QualityProfile } from './Renderer';

const SOFT_POINT = /* glsl */ `
  varying float vAlpha;
  void main() {
    vec2 centered = gl_PointCoord - 0.5;
    float d = dot(centered, centered) * 4.0;
    if (d > 1.0) discard;
    gl_FragColor = vec4(COLOR, (1.0 - d) * vAlpha * OPACITY);
  }
`;

function softPointMaterial(vertexShader: string, color: string, opacity: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader: SOFT_POINT.replace('COLOR', color).replace('OPACITY', opacity),
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

/** Randomly places points within a unit cube, plus a random phase in the colour slot. */
function randomPoints(count: number): THREE.BufferGeometry {
  const positions = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = Math.random();
    positions[i * 3 + 1] = Math.random();
    positions[i * 3 + 2] = Math.random();
    phase[i] = Math.random() * Math.PI * 2;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('phase', new THREE.BufferAttribute(phase, 1));
  // Positions are computed in the shader, so the bounds can't be known ahead of time.
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6);
  return geometry;
}

export class Atmosphere {
  private dust: THREE.Points;
  private snow: THREE.Points;
  private sky: THREE.Mesh;
  private uniforms = {
    time: { value: 0 },
    center: { value: new THREE.Vector3() },
    pixelRatio: { value: 1 },
  };
  readonly windowMaterial: THREE.ShaderMaterial;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];

  constructor(
    private scene: THREE.Scene,
    profile: QualityProfile,
  ) {
    const shared = this.uniforms;

    // Dust wraps around the camera in a 14 m box, so there's always some close by.
    const dustGeometry = randomPoints(profile.dustCount);
    const dustMaterial = softPointMaterial(
      /* glsl */ `
        uniform float time;
        uniform vec3 center;
        uniform float pixelRatio;
        attribute float phase;
        varying float vAlpha;
        void main() {
          vec3 p = position * 14.0;
          p.x += sin(time * 0.06 + phase) * 0.8 + time * 0.02;
          p.y += sin(time * 0.05 + phase * 2.0) * 0.5 - time * 0.012;
          p.z += cos(time * 0.07 + phase) * 0.8;
          vec3 wrapped = mod(p - center + 7.0, 14.0) - 7.0 + center;
          vec4 mv = modelViewMatrix * vec4(wrapped, 1.0);
          float dist = length(wrapped - center);
          vAlpha = smoothstep(7.0, 3.0, dist) * smoothstep(0.3, 1.2, dist) * (0.55 + 0.45 * sin(time * 0.6 + phase));
          gl_PointSize = pixelRatio * (24.0 / max(0.5, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      'vec3(0.82, 0.8, 0.72)',
      '0.05',
      shared,
    );
    this.dust = new THREE.Points(dustGeometry, dustMaterial);
    this.dust.frustumCulled = false;
    scene.add(this.dust);

    // Snow falls and blows through the forecourt only.
    const snowGeometry = randomPoints(profile.snowCount);
    const snowMaterial = softPointMaterial(
      /* glsl */ `
        uniform float time;
        uniform float pixelRatio;
        attribute float phase;
        varying float vAlpha;
        void main() {
          vec3 volumeSize = vec3(32.0, 16.0, 28.0);
          vec3 p = position * volumeSize;
          p.y -= time * (1.4 + sin(phase) * 0.5);
          p.x += time * 2.3 + sin(time * 0.8 + phase) * 1.4;
          p.z += sin(time * 0.5 + phase * 2.0) * 1.2;
          p = mod(p, volumeSize);
          vec3 world = p + vec3(-16.0, 0.0, 26.0);
          vec4 mv = modelViewMatrix * vec4(world, 1.0);
          vAlpha = 0.6 + 0.4 * sin(phase * 3.0);
          gl_PointSize = pixelRatio * (42.0 / max(0.5, -mv.z));
          gl_Position = projectionMatrix * mv;
        }
      `,
      'vec3(0.92, 0.96, 1.0)',
      '0.5',
      shared,
    );
    this.snow = new THREE.Points(snowGeometry, snowMaterial);
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    scene.add(this.snow);
    this.geometries.push(dustGeometry, snowGeometry);
    this.materials.push(dustMaterial, snowMaterial);

    this.sky = this.createSky();
    this.sky.visible = false;
    scene.add(this.sky);

    // Exterior windows share one animated view of night and falling snow.
    this.windowMaterial = new THREE.ShaderMaterial({
      uniforms: { time: shared.time },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float time;
        varying vec2 vUv;
        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float flakes(vec2 uv, float scale, float speed) {
          vec2 p = uv * scale;
          p.y += time * speed;
          p.x += time * speed * 0.6 + sin(time * 0.5 + uv.y * 3.0) * 0.1;
          vec2 cell = floor(p);
          vec2 f = fract(p) - 0.5;
          float h = hash(cell);
          vec2 offset = vec2(hash(cell + 3.1), hash(cell + 7.7)) - 0.5;
          return smoothstep(0.1, 0.0, length(f - offset * 0.7)) * step(0.55, h);
        }
        void main() {
          vec3 night = mix(vec3(0.07, 0.11, 0.17), vec3(0.015, 0.03, 0.06), vUv.y);
          float snow = flakes(vUv, 14.0, 0.9) + flakes(vUv, 26.0, 0.7) * 0.6;
          gl_FragColor = vec4(night + snow * vec3(0.3, 0.34, 0.4), 1.0);
        }
      `,
    });
    this.materials.push(this.windowMaterial);
  }

  private createSky(): THREE.Mesh {
    const geometry = new THREE.SphereGeometry(180, 24, 16);
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vDir;
        float noise(float x) { return fract(sin(x * 91.17) * 437.5); }
        float ridge(float a, float base, float amp) {
          float h = 0.0, f = 1.0, m = 1.0;
          for (int i = 0; i < 5; i++) {
            float x = a * f;
            float i0 = floor(x);
            float t = fract(x);
            h += mix(noise(i0), noise(i0 + 1.0), t * t * (3.0 - 2.0 * t)) * m;
            f *= 2.1;
            m *= 0.5;
          }
          return base + h * amp;
        }
        void main() {
          float y = vDir.y;
          float a = atan(vDir.z, vDir.x) * 5.0;
          vec3 sky = mix(vec3(0.17, 0.23, 0.31), vec3(0.03, 0.05, 0.09), smoothstep(0.0, 0.6, y));
          float far = ridge(a + 3.0, 0.05, 0.16);
          float near = ridge(a * 1.7 + 11.0, 0.0, 0.12);
          sky = mix(sky, vec3(0.13, 0.17, 0.23), step(y, far));
          sky = mix(sky, vec3(0.07, 0.09, 0.12), step(y, near));
          gl_FragColor = vec4(sky, 1.0);
        }
      `,
    });
    this.geometries.push(geometry);
    this.materials.push(material);
    return new THREE.Mesh(geometry, material);
  }

  setExterior(visible: boolean): void {
    this.snow.visible = visible;
    this.sky.visible = visible;
    this.dust.visible = !visible;
  }

  update(time: number, cameraPos: THREE.Vector3, pixelRatio: number): void {
    this.uniforms.time.value = time % 3600;
    this.uniforms.center.value.copy(cameraPos);
    this.uniforms.pixelRatio.value = pixelRatio;
    if (this.sky.visible) this.sky.position.copy(cameraPos);
  }

  dispose(): void {
    this.scene.remove(this.dust, this.snow, this.sky);
    for (const geometry of this.geometries) geometry.dispose();
    for (const material of this.materials) material.dispose();
  }
}
