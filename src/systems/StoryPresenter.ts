// The bridge between what happened and how it feels. The logic layer only announces
// events, such as "the door opened" or "the Hush has begun". This class turns those
// announcements into sound, light and movement on screen.

import type { AudioManager } from '../audio/AudioManager';
import type { GameSession } from '../core/GameSession';
import type { SceneManager } from '../core/SceneManager';
import type { ScriptArgs, Vec3 } from '../core/Script';
import { ItemDatabase } from '../inventory/ItemDatabase';
import type { CameraController } from '../player/CameraController';
import type { LightingManager } from '../rendering/LightingManager';
import type { PostProcessing } from '../rendering/PostProcessing';
import type { HUD } from '../ui/HUD';
import type { DoorStyle } from '../world/LevelDefinition';
import { HUSH_CONFIG, type HushPhase } from './HushSequence';
import type { ListenerActor } from './ListenerActor';

const DOOR_OPEN_SOUND: Record<DoorStyle, string> = {
  wood: 'door:open',
  steel: 'door:open',
  double: 'door:open',
  slide: 'door:heavy',
  blast: 'door:blast',
  hatch: 'door:open',
};

const PHONE_RING_INTERVAL = 4.2;

export interface PresenterServices {
  scene: SceneManager;
  audio: AudioManager;
  hud: HUD;
  lighting: LightingManager;
  post: PostProcessing;
  camera: CameraController;
  listener: ListenerActor;
  /** Runs when the Listener has caught the player and the screen is white with static. */
  onCaught(): void;
  onCheckpoint(): void;
  onEnding(ending: 'silence' | 'answer'): void;
}

export class StoryPresenter {
  private unsubscribers: (() => void)[] = [];
  private silenceTarget = 0;
  private silenceNow = 0;
  private dipTimer = 0;
  private damageTarget = 0;
  private damageNow = 0;
  private phoneTimer = 0;
  private hushWarned = false;
  private musicIntensity = 0.35;

  constructor(
    private session: GameSession,
    private services: PresenterServices,
  ) {
    this.bind();
  }

  private bind(): void {
    const { bus } = this.session;
    const { audio, hud, scene, lighting } = this.services;
    const listen = this.unsubscribers;

    listen.push(
      bus.on('flag:changed', () => {
        scene.syncConditions(this.session, lighting);
        scene.syncDoorLocks(this.session);
      }),
      bus.on('door:opened', ({ doorId }) => {
        const door = scene.world.doors.get(doorId);
        if (!door) return;
        door.setOpen(true);
        audio.play(DOOR_OPEN_SOUND[door.def.style], { at: door.center, wet: 0.5 });
        // Doors are loud. During a Hush, that's the whole problem.
        this.session.hush.addNoise(0.6);
      }),
      bus.on('door:closed', ({ doorId }) => {
        scene.world.doors.get(doorId)?.setOpen(false);
      }),
      bus.on('door:unlocked', () => scene.syncDoorLocks(this.session)),
      bus.on('door:denied', ({ doorId }) => {
        const door = scene.world.doors.get(doorId);
        audio.play('door:locked', door ? { at: door.center, wet: 0.2 } : {});
      }),
      bus.on('interactable:used', () => {
        scene.syncPickups(this.session);
        this.session.hush.addNoise(0.15);
      }),
      bus.on('item:added', ({ itemId }) => {
        const item = ItemDatabase.get(itemId);
        if (item) hud.toast(`Picked up: ${item.name}`);
      }),
      bus.on('inventory:full', () => {
        hud.say('I can\'t carry any more. One of the pneumatic post stations could take something.');
        audio.play('ui:error', { ignoreSilence: true });
      }),
      bus.on('objective:changed', ({ text }) => {
        hud.setObjective(text);
        audio.play('note', { ignoreSilence: true, volume: 0.6 });
      }),
      bus.on('document:discovered', ({ docId }) => {
        if (docId !== 'signal_log') hud.toast('Added to journal');
      }),
      bus.on('say', ({ text, hold }) => hud.say(text, hold)),
      bus.on('toast', ({ text }) => hud.toast(text)),
      bus.on('cue', ({ cue, at }) => this.handleCue(cue, at)),
      bus.on('script', ({ name, args }) => this.handleScript(name, args)),
      bus.on('checkpoint', () => this.services.onCheckpoint()),
      bus.on('ending', ({ ending }) => this.services.onEnding(ending)),
      bus.on('hush:phase', ({ phase, previous }) => this.handleHushPhase(phase, previous)),
      // The fault itself is shown on the device. The world just gives a small jolt.
      bus.on('puzzle:failed', () => this.services.camera.addShake(0.04)),
    );
  }

  private handleCue(cue: string, at?: Vec3): void {
    const { audio, lighting } = this.services;
    switch (cue) {
      case 'lights:flicker':
        lighting.burst(1.4);
        audio.playDistant('distant:settle', 0.45);
        break;
      case 'silence:dip':
        this.dipTimer = 2.8;
        break;
      case 'phone:ring':
        this.phoneTimer = 0.01;
        break;
      case 'radio:whisper':
        audio.play('radio:whisper', { volume: 0.34, ignoreSilence: false });
        audio.play('radio:burst', { volume: 0.2 });
        break;
      default:
        if (cue.startsWith('distant:')) audio.playDistant(cue);
        else audio.play(cue, { at, wet: 0.45 });
    }
  }

  private handleScript(name: string, args: ScriptArgs): void {
    const { audio, lighting, listener, camera } = this.services;
    switch (name) {
      case 'listener:appear':
        listener.appear(args.at as Vec3, args.lookAtPlayer === true, (args.duration as number) ?? 3, args.walkTo as Vec3 | undefined);
        this.session.suspense.raise(0.1);
        camera.addShake(0.05);
        break;
      case 'lights:flicker':
        lighting.burst((args.duration as number) ?? 1.6);
        break;
      case 'lights:restore':
        lighting.restoreSurge();
        camera.addShake(0.16);
        break;
      case 'radio:burst':
        audio.play('radio:burst', { volume: 0.8 });
        break;
      case 'signal:cut':
        lighting.burst(1);
        audio.setAmbience('dawn', 8);
        audio.stopMusic(6);
        break;
      default:
        break;
    }
  }

  private handleHushPhase(phase: HushPhase, previous: HushPhase): void {
    const { audio, hud, lighting, listener, camera } = this.services;
    const config = this.session.hush.id ? HUSH_CONFIG[this.session.hush.id] : null;
    switch (phase) {
      case 'onset':
        this.silenceTarget = 1;
        lighting.setMaster(0.07);
        lighting.burst(1.8);
        hud.setHush(true);
        hud.clearSubtitles();
        audio.setMusicIntensity(0.12);
        audio.play('stinger:low', { ignoreSilence: true, volume: 0.65 });
        camera.addShake(0.22);
        if (!this.hushWarned) {
          this.hushWarned = true;
          if (this.session.check({ read: 'protocol_h' })) hud.say('The sound has gone. Protocol H. Stop. Get low. Don\'t touch anything.', 6);
          else hud.say("Everything's gone quiet. I can't hear my own boots. Something's wrong. Keep still.", 6);
        }
        break;
      case 'stalking':
        if (previous === 'onset' && config) listener.walkPath(config.path, config.duration);
        else listener.setListening(false);
        break;
      case 'noticed':
        listener.setListening(true);
        audio.play('stinger:low', { ignoreSilence: true, volume: 0.32, rate: 1.3 });
        camera.addShake(0.08);
        break;
      case 'caught':
        this.damageTarget = 1;
        audio.play('caught:static', { ignoreSilence: true, volume: 0.9 });
        camera.addShake(0.8);
        break;
      case 'passing':
        listener.dismiss();
        this.endHushEffects();
        break;
      case 'idle':
        // A Hush ends here both ways, so the screen is restored whichever way it went.
        if (previous === 'caught') {
          listener.hide();
          this.endHushEffects();
          this.damageTarget = 0;
          this.services.onCaught();
        }
        hud.setHush(false);
        break;
    }
  }

  private endHushEffects(): void {
    const { audio, lighting, camera } = this.services;
    this.silenceTarget = 0;
    lighting.setMaster(1);
    audio.setMusicIntensity(this.musicIntensity);
    camera.addShake(0.05);
  }

  /** Instantly drops any running effect, used when loading or restarting. */
  reset(): void {
    this.silenceTarget = 0;
    this.silenceNow = 0;
    this.dipTimer = 0;
    this.damageTarget = 0;
    this.damageNow = 0;
    this.phoneTimer = 0;
    const { audio, lighting, listener, post, hud } = this.services;
    audio.setSilence(0);
    lighting.setMaster(1);
    listener.hide();
    post.silence = 0;
    post.damage = 0;
    hud.setHush(false);
  }

  update(dt: number, listenerDistance: number): void {
    const { audio, post } = this.services;
    if (this.dipTimer > 0) this.dipTimer -= dt;
    const target = Math.max(this.silenceTarget, this.dipTimer > 0 ? 0.8 : 0);
    const rate = target > this.silenceNow ? 1.5 : 0.75;
    this.silenceNow += (target - this.silenceNow) * (1 - Math.exp(-rate * dt));
    if (Math.abs(this.silenceNow - target) < 0.002) this.silenceNow = target;

    post.silence = this.silenceNow;
    audio.setSilence(this.silenceNow);
    this.damageNow += (this.damageTarget - this.damageNow) * (1 - Math.exp(-(this.damageTarget > this.damageNow ? 2.2 : 3.2) * dt));
    post.damage = this.damageNow < 0.005 ? 0 : this.damageNow;

    // The heart beats faster the closer it is, and the more it's paying attention.
    const hush = this.session.hush;
    const fear = hush.active ? Math.max(hush.attention, 1 - Math.min(1, listenerDistance / 14)) : 0.2;
    audio.update(dt, 0.9 + fear * 1.7);

    if (this.phoneTimer > 0 && this.session.check({ flag: 'phone_ringing' })) {
      this.phoneTimer -= dt;
      if (this.phoneTimer <= 0) {
        audio.play('phone:ring', { at: [-0.2, 1.1, 12.7], wet: 0.8, volume: 0.8 });
        this.phoneTimer = PHONE_RING_INTERVAL;
      }
    }
  }

  dispose(): void {
    for (const off of this.unsubscribers) off();
    this.unsubscribers = [];
  }
}
