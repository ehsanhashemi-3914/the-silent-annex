// The security room's monitors really do show the building. A handful of small cameras
// render the actual rooms into textures, one per frame in turn, so that a dozen live
// screens cost about the same as drawing the scene one extra time.

import * as THREE from 'three';

export interface FeedView {
  label: string;
  rooms: string[];
  position: THREE.Vector3;
  target: THREE.Vector3;
}

const FEED_WIDTH = 256;
const FEED_HEIGHT = 192;
const UPDATE_INTERVAL = 0.12;

const MONITOR_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const MONITOR_FRAGMENT = /* glsl */ `
  uniform sampler2D feed;
  uniform float time;
  uniform float noiseLevel;
  uniform float colorAmount;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233)) + time * 13.0) * 43758.5453); }
  void main() {
    vec2 uv = vUv;
    // A slow rolling hum bar, and slight horizontal wobble.
    float roll = fract(time * 0.07 + hash(vec2(floor(time * 0.2), 1.0)));
    float bar = smoothstep(0.08, 0.0, abs(uv.y - roll));
    uv.x += bar * 0.012 + sin(uv.y * 80.0 + time * 9.0) * 0.0012;
    vec3 image = texture2D(feed, uv).rgb;
    float luma = dot(image, vec3(0.3, 0.59, 0.11));
    vec3 mono = vec3(luma) * vec3(0.72, 1.0, 0.8);
    vec3 color = mix(mono, image, colorAmount);
    color = pow(max(color * 1.35, 0.0), vec3(0.85));
    float scan = 0.82 + 0.18 * sin(vUv.y * 420.0);
    float grain = hash(vUv * vec2(320.0, 240.0)) - 0.5;
    color = color * scan + grain * (0.05 + noiseLevel) + bar * 0.05;
    float edge = smoothstep(0.0, 0.08, vUv.x) * smoothstep(1.0, 0.92, vUv.x) * smoothstep(0.0, 0.08, vUv.y) * smoothstep(1.0, 0.92, vUv.y);
    gl_FragColor = vec4(color * mix(0.4, 1.0, edge) * 1.3, 1.0);
  }
`;

export class SecurityFeeds {
  private targets: THREE.WebGLRenderTarget[] = [];
  private materials: THREE.ShaderMaterial[] = [];
  private camera = new THREE.PerspectiveCamera(62, FEED_WIDTH / FEED_HEIGHT, 0.1, 80);
  private timer = 0;
  private cursor = 0;
  private time = { value: 0 };
  private monitors: THREE.Mesh[] = [];
  private playbackTime = 0;

  constructor(
    private renderer: THREE.WebGLRenderer,
    private views: FeedView[],
  ) {
    for (let i = 0; i < views.length; i++) {
      this.targets.push(
        new THREE.WebGLRenderTarget(FEED_WIDTH, FEED_HEIGHT, {
          type: THREE.UnsignedByteType,
          colorSpace: THREE.SRGBColorSpace,
        }),
      );
    }
  }

  /** Hands a screen's mesh to the feeds. Monitors beyond the feed count show the same few views. */
  attachMonitors(monitors: THREE.Mesh[]): void {
    this.monitors = monitors;
    monitors.forEach((monitor, index) => {
      const target = this.targets[index % this.targets.length];
      const material = new THREE.ShaderMaterial({
        uniforms: {
          feed: { value: target.texture },
          time: this.time,
          noiseLevel: { value: index % 5 === 4 ? 0.2 : 0 },
          colorAmount: { value: 0 },
        },
        vertexShader: MONITOR_VERTEX,
        fragmentShader: MONITOR_FRAGMENT,
      });
      this.materials.push(material);
      monitor.material = material;
    });
  }

  get monitorCenter(): THREE.Vector3 {
    const center = new THREE.Vector3();
    for (const monitor of this.monitors) center.add(monitor.getWorldPosition(new THREE.Vector3()));
    return center.divideScalar(Math.max(1, this.monitors.length));
  }

  /** For a while, every screen shows the same feed, in colour. */
  startPlayback(duration: number): void {
    this.playbackTime = duration;
    for (const material of this.materials) material.uniforms.colorAmount.value = 0.75;
    for (const material of this.materials) material.uniforms.feed.value = this.targets[0].texture;
    for (const material of this.materials) material.uniforms.noiseLevel.value = 0.03;
  }

  private endPlayback(): void {
    this.materials.forEach((material, index) => {
      material.uniforms.colorAmount.value = 0;
      material.uniforms.feed.value = this.targets[index % this.targets.length].texture;
      material.uniforms.noiseLevel.value = index % 5 === 4 ? 0.2 : 0;
    });
  }

  get playingBack(): boolean {
    return this.playbackTime > 0;
  }

  /**
   * Renders the next feed. `prepare` sets up which rooms are visible for that view,
   * and `restore` puts everything back for the main picture.
   */
  update(dt: number, scene: THREE.Scene, prepare: (view: FeedView) => void, restore: () => void): void {
    this.time.value = (this.time.value + dt) % 1000;
    if (this.playbackTime > 0) {
      this.playbackTime -= dt;
      if (this.playbackTime <= 0) this.endPlayback();
    }
    this.timer -= dt;
    if (this.timer > 0) return;
    this.timer = UPDATE_INTERVAL;

    const index = this.playbackTime > 0 ? 0 : this.cursor;
    this.cursor = (this.cursor + 1) % this.views.length;
    const view = this.views[index];
    this.camera.position.copy(view.position);
    this.camera.lookAt(view.target);

    prepare(view);
    const previousShadows = this.renderer.shadowMap.autoUpdate;
    const previousTone = this.renderer.toneMapping;
    const previousTarget = this.renderer.getRenderTarget();
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.setRenderTarget(this.targets[index]);
    this.renderer.clear();
    this.renderer.render(scene, this.camera);
    this.renderer.setRenderTarget(previousTarget);
    this.renderer.shadowMap.autoUpdate = previousShadows;
    this.renderer.toneMapping = previousTone;
    restore();
  }

  dispose(): void {
    for (const target of this.targets) target.dispose();
    for (const material of this.materials) material.dispose();
  }
}
