// The game's mixer. Sounds are routed through buses (music, effects, ambience), so one
// slider can control a whole category, and a special "world" stage sits before the output
// so that a Hush can drain all sound from the building in one move.

import * as THREE from 'three';
import type { SettingsData } from '../core/Settings';
import type { Vec3 } from '../core/Script';
import type { AmbienceId, ReverbId, SurfaceId } from '../world/LevelDefinition';
import { AmbientAudio } from './AmbientAudio';
import { SoundBank } from './SoundEffects';

const MAX_CONCURRENT = 26;
const SILENCE_FADE = 1.6;

export interface PlayOptions {
  /** Plays from a place in the world rather than straight through the speakers. */
  at?: Vec3 | THREE.Vector3;
  volume?: number;
  rate?: number;
  /** How much of this sound goes to the room's reverb, from 0 to 1. */
  wet?: number;
  /** UI sounds carry on even when the world has gone silent. */
  ignoreSilence?: boolean;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private music: GainNode | null = null;
  private sfx: GainNode | null = null;
  private ambient: GainNode | null = null;
  private world: GainNode | null = null;
  private worldFilter: BiquadFilterNode | null = null;
  private dry: GainNode | null = null;
  private ambientAudio: AmbientAudio | null = null;
  private bank: SoundBank | null = null;
  private active = 0;
  private silenceAmount = 0;
  private heartbeatTimer = 0;
  private tinnitusSource: AudioBufferSourceNode | null = null;
  private tinnitusGain: GainNode | null = null;
  private pendingAmbience: AmbienceId | null = null;
  private pendingReverb: ReverbId | null = null;
  private pendingMusic: number | null = null;
  private stepVariation = 0;
  private listenerPosition = new THREE.Vector3();
  private listenerForward = new THREE.Vector3();
  private volumes: SettingsData;

  constructor(settings: SettingsData) {
    this.volumes = settings;
  }

  /** Browsers only allow audio after a user gesture, so the first click or key calls this. */
  unlock(): void {
    if (!this.ctx) this.initialise();
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  private initialise(): void {
    const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);

    this.world = ctx.createGain();
    this.worldFilter = ctx.createBiquadFilter();
    this.worldFilter.type = 'lowpass';
    this.worldFilter.frequency.value = 20000;
    this.world.connect(this.worldFilter);
    this.worldFilter.connect(this.master);

    this.music = ctx.createGain();
    this.music.connect(this.master);
    this.ambient = ctx.createGain();
    this.ambient.connect(this.world);
    this.sfx = ctx.createGain();
    this.sfx.connect(this.world);
    // Dry UI effects bypass the world stage, so menus can be heard during a Hush.
    this.dry = ctx.createGain();
    this.dry.connect(this.master);

    this.bank = new SoundBank(ctx);
    this.ambientAudio = new AmbientAudio(ctx, this.ambient, this.music, this.sfx);
    this.applyVolumes(this.volumes);

    if (this.pendingAmbience) this.ambientAudio.setAmbience(this.pendingAmbience);
    if (this.pendingReverb) this.ambientAudio.setReverb(this.pendingReverb);
    if (this.pendingMusic !== null) this.ambientAudio.startMusic(this.pendingMusic);
  }

  applyVolumes(settings: SettingsData): void {
    this.volumes = settings;
    if (!this.ctx || !this.master || !this.music || !this.sfx || !this.ambient || !this.dry) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(settings.masterVolume, now, 0.03);
    this.music.gain.setTargetAtTime(settings.musicVolume, now, 0.03);
    this.sfx.gain.setTargetAtTime(settings.sfxVolume, now, 0.03);
    this.dry.gain.setTargetAtTime(settings.sfxVolume, now, 0.03);
    this.ambient.gain.setTargetAtTime(settings.ambientVolume * 0.7, now, 0.03);
  }

  setAmbience(id: AmbienceId, fade?: number): void {
    this.pendingAmbience = id;
    this.ambientAudio?.setAmbience(id, fade);
  }

  setReverb(id: ReverbId): void {
    this.pendingReverb = id;
    this.ambientAudio?.setReverb(id);
  }

  startMusic(intensity: number): void {
    this.pendingMusic = intensity;
    this.ambientAudio?.startMusic(intensity);
  }

  setMusicIntensity(intensity: number): void {
    this.pendingMusic = intensity;
    this.ambientAudio?.setMusicIntensity(intensity);
  }

  stopMusic(fade?: number): void {
    this.pendingMusic = null;
    this.ambientAudio?.stopMusic(fade);
  }

  play(name: string, options: PlayOptions = {}): void {
    if (!this.ctx || !this.bank || this.active >= MAX_CONCURRENT || this.ctx.state !== 'running') return;
    const buffer = this.bank.get(name);
    if (!buffer) return;
    const ctx = this.ctx;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = options.rate ?? 1;

    const gain = ctx.createGain();
    gain.gain.value = options.volume ?? 1;
    source.connect(gain);

    let output: AudioNode = gain;
    if (options.at) {
      const panner = ctx.createPanner();
      panner.panningModel = 'equalpower';
      panner.distanceModel = 'inverse';
      panner.refDistance = 2.5;
      panner.rolloffFactor = 1.1;
      const [x, y, z] = options.at instanceof THREE.Vector3 ? [options.at.x, options.at.y, options.at.z] : options.at;
      panner.positionX.value = x;
      panner.positionY.value = y;
      panner.positionZ.value = z;
      gain.connect(panner);
      output = panner;
    }
    output.connect(options.ignoreSilence ? (this.dry as GainNode) : (this.sfx as GainNode));
    if (!options.ignoreSilence && options.wet && this.ambientAudio) {
      const send = ctx.createGain();
      send.gain.value = options.wet;
      output.connect(send);
      send.connect(this.ambientAudio.reverbInput);
    }

    this.active++;
    source.onended = () => {
      this.active--;
      source.disconnect();
      gain.disconnect();
      if (output !== gain) output.disconnect();
    };
    source.start();
  }

  footstep(surface: SurfaceId, loudness: number): void {
    this.stepVariation = (this.stepVariation + 1 + Math.floor(Math.random() * 3)) % 4;
    this.play(`step:${surface}:${this.stepVariation}`, {
      volume: loudness,
      rate: 0.94 + Math.random() * 0.12,
      wet: 0.3,
    });
  }

  /** A sound from somewhere in the building, set away from the player in a random direction. */
  playDistant(name: string, volume = 0.6): void {
    const angle = Math.random() * Math.PI * 2;
    const distance = 11 + Math.random() * 14;
    const at = this.listenerPosition.clone();
    at.x += Math.cos(angle) * distance;
    at.z += Math.sin(angle) * distance;
    this.play(name, { at, volume, wet: 0.9, rate: 0.9 + Math.random() * 0.2 });
  }

  updateListener(position: THREE.Vector3, forward: THREE.Vector3): void {
    this.listenerPosition.copy(position);
    this.listenerForward.copy(forward);
    if (!this.ctx) return;
    const listener = this.ctx.listener;
    if (listener.positionX) {
      listener.positionX.value = position.x;
      listener.positionY.value = position.y;
      listener.positionZ.value = position.z;
      listener.forwardX.value = forward.x;
      listener.forwardY.value = forward.y;
      listener.forwardZ.value = forward.z;
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    }
  }

  /**
   * The signature effect. As the world drains away, a thin ringing and the player's
   * own heartbeat take its place. Hearing it is what tells them to stop moving.
   */
  setSilence(amount: number): void {
    this.silenceAmount = amount;
    if (!this.ctx || !this.world || !this.worldFilter) return;
    const now = this.ctx.currentTime;
    this.world.gain.setTargetAtTime(1 - amount * 0.95, now, SILENCE_FADE / 3);
    this.worldFilter.frequency.setTargetAtTime(amount > 0.05 ? 420 + (1 - amount) * 12000 : 20000, now, SILENCE_FADE / 3);
    if (amount > 0.05 && !this.tinnitusSource) this.startTinnitus();
    if (this.tinnitusGain) this.tinnitusGain.gain.setTargetAtTime(amount * 0.8, now, 0.6);
    if (amount <= 0.05 && this.tinnitusSource) {
      const source = this.tinnitusSource;
      source.stop(now + 2);
      this.tinnitusSource = null;
      this.tinnitusGain = null;
    }
  }

  private startTinnitus(): void {
    if (!this.ctx || !this.bank || !this.dry) return;
    const buffer = this.bank.get('tinnitus');
    if (!buffer) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    const gain = this.ctx.createGain();
    gain.gain.value = 0;
    source.connect(gain);
    gain.connect(this.dry);
    source.start();
    this.tinnitusSource = source;
    this.tinnitusGain = gain;
  }

  update(dt: number, heartbeatRate: number): void {
    if (this.silenceAmount < 0.3) return;
    this.heartbeatTimer -= dt;
    if (this.heartbeatTimer <= 0) {
      this.play('heartbeat', { ignoreSilence: true, volume: 0.32 + this.silenceAmount * 0.5 });
      this.heartbeatTimer = 1.15 / Math.max(0.5, heartbeatRate);
    }
  }

  /** A summary for automated checks, since sound can't be seen in a screenshot. */
  debugState(): { state: string; activeSounds: number; silence: number; ambience: string | null } {
    return { state: this.ctx?.state ?? 'not started', activeSounds: this.active, silence: this.silenceAmount, ambience: this.pendingAmbience };
  }

  /** Pauses all sound along with the game. */
  suspend(): void {
    if (this.ctx?.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  dispose(): void {
    this.ambientAudio?.dispose();
    this.bank?.clear();
    void this.ctx?.close();
    this.ctx = null;
  }
}
