// Continuous sound: each kind of space has its own loops, crossfaded as the player moves
// from room to room. A generative drone plays underneath as the score, so it never repeats.

import type { AmbienceId, ReverbId } from '../world/LevelDefinition';
import { makeImpulse, makeNoiseLoop, render } from './Synth';

interface Layer {
  /** Which buffer this layer plays. */
  loop: string;
  gain: number;
  /** Optional slow volume movement, in hertz. */
  lfo?: number;
  lfoDepth?: number;
}

const AMBIENCES: Record<AmbienceId, Layer[]> = {
  wind: [
    { loop: 'windLow', gain: 0.8, lfo: 0.09, lfoDepth: 0.35 },
    { loop: 'windHigh', gain: 0.32, lfo: 0.17, lfoDepth: 0.2 },
  ],
  lobby: [
    { loop: 'windLow', gain: 0.1, lfo: 0.07, lfoDepth: 0.06 },
    { loop: 'roomTone', gain: 0.5 },
  ],
  hum: [
    { loop: 'mains', gain: 0.26 },
    { loop: 'roomTone', gain: 0.5 },
  ],
  lab: [
    { loop: 'mains', gain: 0.1 },
    { loop: 'roomTone', gain: 0.38 },
    { loop: 'equipment', gain: 0.1, lfo: 0.11, lfoDepth: 0.04 },
  ],
  deep: [
    { loop: 'rumble', gain: 0.62, lfo: 0.05, lfoDepth: 0.14 },
    { loop: 'roomTone', gain: 0.3 },
  ],
  annex: [{ loop: 'nearSilence', gain: 0.5 }],
  dawn: [
    { loop: 'windHigh', gain: 0.22, lfo: 0.12, lfoDepth: 0.1 },
    { loop: 'windLow', gain: 0.4, lfo: 0.08, lfoDepth: 0.14 },
  ],
};

interface ActiveLayer {
  source: AudioBufferSourceNode;
  gain: GainNode;
  lfo?: OscillatorNode;
  lfoGain?: GainNode;
}

export class AmbientAudio {
  private loops = new Map<string, AudioBuffer>();
  private impulses = new Map<ReverbId, AudioBuffer>();
  private current: AmbienceId | null = null;
  private active: ActiveLayer[] = [];
  private convolvers: ConvolverNode[] = [];
  private convolverIndex = 0;
  private wetGains: GainNode[] = [];
  private currentReverb: ReverbId | null = null;
  private musicNodes: AudioScheduledSourceNode[] = [];
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private noteOutput: GainNode | null = null;

  /** Sends to here are heard with the current room's reverb applied. */
  readonly reverbInput: GainNode;

  constructor(
    private ctx: AudioContext,
    private ambientBus: GainNode,
    private musicBus: GainNode,
    reverbOutput: GainNode,
  ) {
    this.reverbInput = ctx.createGain();
    for (let i = 0; i < 2; i++) {
      const convolver = ctx.createConvolver();
      const wet = ctx.createGain();
      wet.gain.value = 0;
      this.reverbInput.connect(convolver);
      convolver.connect(wet);
      wet.connect(reverbOutput);
      this.convolvers.push(convolver);
      this.wetGains.push(wet);
    }
  }

  private buffer(name: string): AudioBuffer {
    const cached = this.loops.get(name);
    if (cached) return cached;
    const ctx = this.ctx;
    let buffer: AudioBuffer;
    switch (name) {
      case 'windLow':
        buffer = makeNoiseLoop(ctx, 11, 340, 201, 1.3);
        break;
      case 'windHigh':
        buffer = makeNoiseLoop(ctx, 9, 1900, 202, 0.6);
        break;
      case 'roomTone':
        buffer = makeNoiseLoop(ctx, 8, 190, 203, 0.5);
        break;
      case 'rumble':
        buffer = makeNoiseLoop(ctx, 13, 95, 204, 2.2);
        break;
      case 'nearSilence':
        buffer = makeNoiseLoop(ctx, 7, 70, 205, 0.35);
        break;
      case 'mains':
        // Fifty-hertz hum with its harmonics, the sound of old fluorescent ballasts.
        buffer = render(
          ctx,
          2,
          (t) =>
            Math.sin(2 * Math.PI * 50 * t) * 0.3 +
            Math.sin(2 * Math.PI * 100 * t) * 0.5 +
            Math.sin(2 * Math.PI * 150 * t) * 0.14 +
            Math.sin(2 * Math.PI * 200 * t) * 0.08,
        );
        break;
      case 'equipment':
        buffer = render(ctx, 4, (t) => (Math.sin(2 * Math.PI * 440 * t) * 0.1 + Math.sin(2 * Math.PI * 7350 * t) * 0.14) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.5 * t)));
        break;
      default:
        throw new Error(`Unknown ambient loop ${name}`);
    }
    this.loops.set(name, buffer);
    return buffer;
  }

  private impulse(id: ReverbId): AudioBuffer {
    const cached = this.impulses.get(id);
    if (cached) return cached;
    const specs: Record<ReverbId, [number, number, number]> = {
      outside: [0.35, 1800, 301],
      hall: [3.1, 3400, 302],
      room: [0.85, 2400, 303],
      corridor: [1.6, 2600, 304],
      dead: [0.09, 900, 305],
      bunker: [2.7, 1500, 306],
      cathedral: [4.6, 2000, 307],
    };
    const [seconds, brightness, seed] = specs[id];
    const buffer = makeImpulse(this.ctx, seconds, brightness, seed);
    this.impulses.set(id, buffer);
    return buffer;
  }

  /** Crossfades to the loops for a kind of space. */
  setAmbience(id: AmbienceId, fade = 2.2): void {
    if (id === this.current) return;
    this.current = id;
    const now = this.ctx.currentTime;
    for (const layer of this.active) {
      layer.gain.gain.cancelScheduledValues(now);
      layer.gain.gain.setValueAtTime(layer.gain.gain.value, now);
      layer.gain.gain.linearRampToValueAtTime(0, now + fade);
      layer.source.stop(now + fade + 0.1);
      layer.lfo?.stop(now + fade + 0.1);
    }
    this.active = AMBIENCES[id].map((spec) => {
      const source = this.ctx.createBufferSource();
      source.buffer = this.buffer(spec.loop);
      source.loop = true;
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      gain.gain.linearRampToValueAtTime(spec.gain, now + fade);
      source.connect(gain);
      gain.connect(this.ambientBus);
      source.start(now, Math.random() * 3);
      const layer: ActiveLayer = { source, gain };
      if (spec.lfo) {
        layer.lfo = this.ctx.createOscillator();
        layer.lfo.frequency.value = spec.lfo;
        layer.lfoGain = this.ctx.createGain();
        layer.lfoGain.gain.value = spec.lfoDepth ?? 0.1;
        layer.lfo.connect(layer.lfoGain);
        layer.lfoGain.connect(gain.gain);
        layer.lfo.start();
      }
      return layer;
    });
  }

  /** Fades across to a different room response, using two convolvers to avoid a click. */
  setReverb(id: ReverbId): void {
    if (id === this.currentReverb) return;
    this.currentReverb = id;
    const now = this.ctx.currentTime;
    const old = this.wetGains[this.convolverIndex];
    old.gain.cancelScheduledValues(now);
    old.gain.setValueAtTime(old.gain.value, now);
    old.gain.linearRampToValueAtTime(0, now + 0.8);
    this.convolverIndex = 1 - this.convolverIndex;
    this.convolvers[this.convolverIndex].buffer = this.impulse(id);
    const next = this.wetGains[this.convolverIndex];
    const level = id === 'dead' ? 0.05 : id === 'outside' ? 0.1 : id === 'room' ? 0.2 : 0.34;
    next.gain.cancelScheduledValues(now);
    next.gain.setValueAtTime(0, now);
    next.gain.linearRampToValueAtTime(level, now + 0.8);
  }

  /**
   * The score: a slowly beating low drone with sparse, far-off notes that never quite
   * become a melody. Intensity lifts the drone during tense sections.
   */
  startMusic(intensity = 0.4): void {
    if (this.musicGain) {
      this.setMusicIntensity(intensity);
      return;
    }
    const ctx = this.ctx;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.musicGain.connect(filter);
    filter.connect(this.musicBus);

    // Detuned pairs beat slowly against each other, and that's where the unease comes from.
    for (const [frequency, amount] of [
      [55, 0.3],
      [55.35, 0.3],
      [82.4, 0.12],
      [116.8, 0.08],
      [130.4, 0.05],
    ] as const) {
      const oscillator = ctx.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = frequency;
      const gain = ctx.createGain();
      gain.gain.value = amount;
      oscillator.connect(gain);
      gain.connect(this.musicGain);
      oscillator.start();
      this.musicNodes.push(oscillator);
    }
    this.setMusicIntensity(intensity);

    this.noteOutput = ctx.createGain();
    this.noteOutput.gain.value = 0.5;
    this.noteOutput.connect(this.musicBus);
    this.noteOutput.connect(this.reverbInput);
    this.scheduleNote();
  }

  private scheduleNote(): void {
    this.musicTimer = window.setTimeout(() => {
      this.playNote();
      this.scheduleNote();
    }, 7000 + Math.random() * 13000);
  }

  private playNote(): void {
    if (!this.noteOutput) return;
    const ctx = this.ctx;
    const notes = [220, 233.1, 277.2, 329.6, 349.2, 415.3];
    const frequency = notes[Math.floor(Math.random() * notes.length)];
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const modulator = ctx.createOscillator();
    const modGain = ctx.createGain();
    const gain = ctx.createGain();
    oscillator.frequency.value = frequency;
    modulator.frequency.value = frequency * 2.01;
    modGain.gain.setValueAtTime(frequency * 0.9, now);
    modGain.gain.exponentialRampToValueAtTime(1, now + 1.4);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.09, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0005, now + 5);
    modulator.connect(modGain);
    modGain.connect(oscillator.frequency);
    oscillator.connect(gain);
    gain.connect(this.noteOutput);
    oscillator.start(now);
    modulator.start(now);
    oscillator.stop(now + 5.2);
    modulator.stop(now + 5.2);
  }

  setMusicIntensity(intensity: number): void {
    if (!this.musicGain) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(0.1 + intensity * 0.42, now + 3);
  }

  stopMusic(fade = 2): void {
    if (!this.musicGain) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setValueAtTime(this.musicGain.gain.value, now);
    this.musicGain.gain.linearRampToValueAtTime(0, now + fade);
    for (const node of this.musicNodes) node.stop(now + fade + 0.1);
    this.musicNodes = [];
    this.musicGain = null;
    if (this.musicTimer !== null) window.clearTimeout(this.musicTimer);
    this.musicTimer = null;
    this.noteOutput = null;
  }

  dispose(): void {
    this.stopMusic(0.01);
    for (const layer of this.active) {
      layer.source.stop();
      layer.lfo?.stop();
    }
    this.active = [];
    this.current = null;
  }
}
