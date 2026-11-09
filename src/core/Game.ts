// The composition root: it creates every system, connects them, and runs the main loop.
// Gameplay rules live elsewhere. This file only decides what runs when.

import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';
import { SoundBank } from '../audio/SoundEffects';
import { MaterialLibrary } from '../assets/materials/MaterialLibrary';
import type { Interactable } from '../interaction/Interactable';
import type { InteractionOutcome } from '../interaction/InteractionLogic';
import { InteractionSystem } from '../interaction/InteractionSystem';
import { ItemDatabase } from '../inventory/ItemDatabase';
import { CollisionManager } from '../physics/CollisionManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CameraController } from '../player/CameraController';
import { PlayerAnimation, type GesturePose } from '../player/PlayerAnimation';
import { createCharacter, type CharacterRig } from '../player/PlayerCharacter';
import { PlayerController } from '../player/PlayerController';
import { DOCUMENTS } from '../progression/content/documents';
import { ANSWER_LINES, ENDINGS, INTRO_CARDS } from '../progression/content/endings';
import { Atmosphere } from '../rendering/Atmosphere';
import { LightingManager } from '../rendering/LightingManager';
import { PostProcessing } from '../rendering/PostProcessing';
import { QUALITY_PROFILES, Renderer, suggestQuality } from '../rendering/Renderer';
import { SecurityFeeds, type FeedView } from '../rendering/SecurityFeeds';
import { createStorage, SaveManager, type SaveSlot } from '../saving/SaveManager';
import { ListenerActor } from '../systems/ListenerActor';
import { StoryPresenter } from '../systems/StoryPresenter';
import { CardSequence, EndingScreen, LoadingScreen } from '../ui/Cards';
import { DocumentUI } from '../ui/DocumentUI';
import { el } from '../ui/dom';
import { HUD } from '../ui/HUD';
import { InventoryUI, PostUI } from '../ui/InventoryUI';
import { ItemInspector } from '../ui/ItemInspector';
import { JournalUI } from '../ui/JournalUI';
import { CreditsScreen, MainMenu } from '../ui/MainMenu';
import { ConfirmScreen, PauseMenu } from '../ui/PauseMenu';
import { createPuzzleScreen } from '../ui/PuzzleUI';
import { SaveLoadUI } from '../ui/SaveLoadUI';
import { SettingsUI } from '../ui/SettingsUI';
import { UIManager } from '../ui/UIManager';
import { CameraZones } from '../world/CameraZone';
import type { InteractableDef } from '../world/LevelDefinition';
import { LEVEL, ROOM_IDS } from '../world/levels';
import { GameLoop } from './GameLoop';
import { GameSession } from './GameSession';
import { InputManager } from './InputManager';
import { SceneManager } from './SceneManager';
import type { EndingId, Vec3 } from './Script';
import { Settings } from './Settings';

type GameMode = 'booting' | 'menu' | 'playing' | 'ending';

const TORCH_INTENSITY = 130;
const TORCH_DEAD_LEVEL = 0.07;
const GESTURE_TIME = 0.75;
const CCTV_PLAYBACK_TIME = 10;

/** Lets the browser repaint the loading bar. The timeout keeps loading moving in a background tab. */
const nextFrame = () =>
  new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
    window.setTimeout(resolve, 60);
  });
const wait = (seconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, seconds * 1000));

const tempForward = new THREE.Vector3();
const tempHand = new THREE.Vector3();
const tempPlayer = new THREE.Vector3();
const tempAim = new THREE.Vector3();

function shortestAngle(from: number, to: number): number {
  return Math.atan2(Math.sin(to - from), Math.cos(to - from));
}

export class Game {
  private settings = new Settings(suggestQuality());
  private storage = createStorage();
  private saves = new SaveManager(this.storage.storage, ROOM_IDS);
  private audio = new AudioManager(this.settings.data);
  private hud = new HUD();
  private ui: UIManager;
  private input: InputManager;

  private mode: GameMode = 'booting';
  private session: GameSession;
  private presenter: StoryPresenter | null = null;

  private renderer!: Renderer;
  private materials!: MaterialLibrary;
  private physics!: PhysicsWorld;
  private collision!: CollisionManager;
  private sceneManager!: SceneManager;
  private lighting!: LightingManager;
  private post!: PostProcessing;
  private atmosphere!: Atmosphere;
  private player!: PlayerController;
  private rig!: CharacterRig;
  private animation!: PlayerAnimation;
  private cameraController!: CameraController;
  private interaction!: InteractionSystem;
  private listener!: ListenerActor;
  private feeds!: SecurityFeeds;
  private inspector!: ItemInspector;
  private zones = new CameraZones(LEVEL);
  private loop: GameLoop;

  /** Ilse as she appears on the 1986 security footage. Only ever drawn into a feed. */
  private footageRig!: CharacterRig;
  private footageAnimation!: PlayerAnimation;
  private footageTime = 0;
  /** A still figure that shows up on one of the live feeds, once the player knows what it means. */
  private feedGhost!: CharacterRig;

  private time = 0;
  private interpolated = new THREE.Vector3();
  private flashlightOn = true;
  private pendingCrouch = false;
  /** While above zero the player has no control: a cutscene, lift ride or fade is running. */
  private inputLocks = 0;
  private gesture: GesturePose = 'none';
  private gestureTimer = 0;
  private moveBasisYaw = 0;
  private holdingBasis = false;
  private lastZoneId: string | null = null;
  private menuCameraTime = 0;
  private hadPointerLock = false;
  private ignorePointerUnlock = false;
  private torchLevel = 0;

  constructor(
    private canvas: HTMLCanvasElement,
    uiRoot: HTMLElement,
  ) {
    this.ui = new UIManager(uiRoot, (name) => this.audio.play(name, { ignoreSilence: true }));
    this.ui.hudLayer.append(this.hud.root);
    this.input = new InputManager(canvas, this.settings);
    this.session = new GameSession(LEVEL);
    this.loop = new GameLoop({
      fixedUpdate: (dt) => this.fixedUpdate(dt),
      update: (dt) => this.update(dt),
    });

    this.input.onKeyDown = (code, event) => {
      this.audio.unlock();
      if (code === 'Tab') event.preventDefault();
      if (!this.ui.blocking) return false;
      // While any screen is up, the keyboard belongs to it, whether or not it does anything.
      this.ui.handleKey(code, event);
      return true;
    };
    window.addEventListener('pointerdown', () => this.audio.unlock());
    window.addEventListener('resize', () => this.handleResize());
    document.addEventListener('pointerlockchange', () => this.handlePointerLockChange());
    canvas.addEventListener('click', () => {
      if (this.mode === 'playing' && !this.ui.blocking) this.input.requestPointerLock();
    });
    this.ui.onStackChange = (blocking) => this.handleStackChange(blocking);
    this.settings.onChange((data) => {
      this.audio.applyVolumes(data);
      this.applyCameraSettings();
      // Settings can be restored before the renderer exists, during loading.
      if (this.post) this.post.brightness = data.brightness;
    });
  }

  /** Builds everything, reporting progress to the loading screen. */
  async boot(): Promise<void> {
    const loading = new LoadingScreen();
    this.ui.layer.append(loading.root);
    try {
      await this.loadEverything((fraction, note) => {
        loading.setProgress(fraction, note);
        return nextFrame();
      });
    } catch (error) {
      console.error(error);
      loading.showError(
        error instanceof Error && /webgl/i.test(error.message)
          ? 'This game needs WebGL 2, which your browser or graphics driver could not provide. Try updating your browser or enabling hardware acceleration.'
          : 'Something went wrong while building the facility. Reloading the page may help. The browser console has the details.',
      );
      return;
    }
    loading.remove();
    this.enterMenu();
    this.loop.start();
  }

  private async loadEverything(progress: (fraction: number, note: string) => Promise<void>): Promise<void> {
    await progress(0.02, 'Loading type');
    await this.loadFonts();

    await progress(0.05, 'Starting renderer');
    const quality = this.settings.data.quality;
    this.renderer = new Renderer(this.canvas, quality);
    this.renderer.setQuality(quality, this.settings.data.renderScale);
    const profile = QUALITY_PROFILES[quality];

    await progress(0.08, 'Starting physics');
    this.physics = await PhysicsWorld.create();
    this.collision = new CollisionManager(this.physics);

    // Painting textures is the slowest step, so it reports back as it goes.
    this.materials = new MaterialLibrary(profile.textureSize, profile.anisotropy);
    const ids = this.materials.ids;
    for (let i = 0; i < ids.length; i++) {
      if (i % 3 === 0) await progress(0.1 + (i / ids.length) * 0.4, 'Painting surfaces');
      this.materials.get(ids[i]);
    }

    this.sceneManager = new SceneManager(LEVEL, this.materials, this.collision);
    const builder = this.sceneManager.build();
    let builtRooms = 0;
    for (let step = builder.next(); !step.done; step = builder.next()) {
      builtRooms++;
      await progress(0.5 + (builtRooms / LEVEL.rooms.length) * 0.3, `Building ${step.value}`);
    }

    await progress(0.82, 'Lighting the building');
    const scene = this.sceneManager.scene;
    this.lighting = new LightingManager(scene, profile, (condition) => this.session.check(condition));
    this.atmosphere = new Atmosphere(scene, profile);
    for (const room of this.sceneManager.world.rooms.values()) {
      for (const mesh of room.windowSkies) mesh.material = this.atmosphere.windowMaterial;
    }
    this.sceneManager.createEnvironment(this.renderer.three);

    await progress(0.86, 'Dressing the protagonist');
    this.rig = createCharacter(this.materials);
    scene.add(this.rig.root);
    this.animation = new PlayerAnimation(this.rig);
    this.animation.onFootstep = () => this.onFootstep();
    this.footageRig = createCharacter(this.materials);
    this.footageRig.root.visible = false;
    scene.add(this.footageRig.root);
    this.footageAnimation = new PlayerAnimation(this.footageRig);
    this.feedGhost = createCharacter(this.materials, this.materials.get('listener'));
    this.feedGhost.root.visible = false;
    this.feedGhost.root.position.set(-2, -14, -9.5);
    this.feedGhost.root.rotation.y = -Math.PI / 2;
    scene.add(this.feedGhost.root);
    new PlayerAnimation(this.feedGhost).update(0.1, { speed: 0, crouch: 0, aimPitch: 0, aimYaw: 0, aiming: false, gesture: 'none' });
    this.listener = new ListenerActor(scene, this.materials);

    const start = new THREE.Vector3(...LEVEL.start.pos);
    this.player = new PlayerController(this.physics, start, LEVEL.start.yaw);
    this.cameraController = new CameraController(window.innerWidth / window.innerHeight, this.physics, () => this.player?.collider);
    this.applyCameraSettings();
    scene.add(this.cameraController.camera);

    this.interaction = new InteractionSystem(this.sceneManager.world.interactables, this.physics, () => this.player.collider);

    this.post = new PostProcessing(this.renderer.three, scene, this.cameraController.camera, profile, this.renderer.width, this.renderer.height);
    this.post.setSize(this.renderer.width, this.renderer.height, this.renderer.pixelRatio);
    this.post.brightness = this.settings.data.brightness;

    await progress(0.9, 'Wiring the cameras');
    this.feeds = new SecurityFeeds(this.renderer.three, this.feedViews());
    this.feeds.attachMonitors(this.sceneManager.room('security').feedMonitors);

    await progress(0.93, 'Cataloguing the inventory');
    this.inspector = new ItemInspector(this.renderer.three, this.materials);
    for (const item of ItemDatabase.all) this.inspector.icon(item.id);

    // Compiling every shader now avoids a stutter the first time each room comes into view.
    await progress(0.96, 'Warming up');
    this.physics.step();
    this.bindSession(this.session);
    this.sceneManager.showEverything();
    this.renderer.three.compile(scene, this.cameraController.camera);
    await progress(1, '');
  }

  private async loadFonts(): Promise<void> {
    if (!document.fonts) return;
    const faces = ['500 40px "Cormorant Garamond"', 'italic 400 34px "Cormorant Garamond"', '600 40px "Barlow Condensed"', '400 20px "Courier Prime"', '400 20px "VT323"'];
    // Canvas art needs these before it's drawn, though a failed font must not stop the game.
    await Promise.allSettled(faces.map((face) => document.fonts.load(face)));
  }

  private feedViews(): FeedView[] {
    const view = (label: string, rooms: string[], position: Vec3, target: Vec3): FeedView => ({
      label,
      rooms,
      position: new THREE.Vector3(...position),
      target: new THREE.Vector3(...target),
    });
    return [
      // Camera 4, the one on the reel, always comes first.
      view('CORRIDOR', ['labCorridor'], [-5.5, 2.85, 7.2], [-13, 0.6, 6]),
      view('LOBBY', ['reception', 'mainEntrance'], [-8.8, 6.4, 20.6], [2, 0.8, 10]),
      view('ARCHIVE', ['archive'], [-8, -9.2, -13], [-8, -14, -27]),
      view('LEVEL C', ['underCorridor'], [7.8, -10.3, -8], [-14, -13.2, -9.5]),
      view('ANNEX DOOR', ['underCorridor'], [-14, -10.3, -11], [-26, -12.6, -9.5]),
      view('WAITING', ['waiting'], [-11, 3.2, 19.6], [-18, 0.6, 12]),
    ];
  }

  private applyCameraSettings(): void {
    if (!this.cameraController) return;
    const { data } = this.settings;
    this.cameraController.sensitivity = data.mouseSensitivity;
    this.cameraController.invertY = data.invertY;
    this.cameraController.baseFov = data.fov;
  }

  private handleResize(): void {
    if (!this.renderer) return;
    this.renderer.applySize();
    this.post.setSize(this.renderer.width, this.renderer.height, this.renderer.pixelRatio);
    const { camera } = this.cameraController;
    camera.aspect = this.renderer.width / this.renderer.height;
    camera.updateProjectionMatrix();
  }

  private handlePointerLockChange(): void {
    if (document.pointerLockElement) {
      this.hadPointerLock = true;
      return;
    }
    // The browser takes Esc for itself to release the mouse, so that's the cue to pause.
    if (this.ignorePointerUnlock) {
      this.ignorePointerUnlock = false;
      return;
    }
    if (this.hadPointerLock && this.mode === 'playing' && !this.ui.blocking && this.inputLocks === 0) this.openPause();
  }

  private handleStackChange(blocking: boolean): void {
    this.hud.setCovered(blocking);
    if (this.mode !== 'playing') return;
    if (blocking) {
      this.ignorePointerUnlock = document.pointerLockElement !== null;
      this.input.exitPointerLock();
    } else {
      this.input.clearPresses();
      if (this.inputLocks === 0) this.input.requestPointerLock();
    }
  }

  // Session lifetime

  private bindSession(session: GameSession): void {
    this.presenter?.dispose();
    this.session = session;
    this.presenter = new StoryPresenter(session, {
      scene: this.sceneManager,
      audio: this.audio,
      hud: this.hud,
      lighting: this.lighting,
      post: this.post,
      camera: this.cameraController,
      listener: this.listener,
      onCaught: () => void this.wakeFromCaught(),
      onCheckpoint: () => this.autosave(),
      onEnding: (ending) => void this.playEnding(ending),
    });
    this.sceneManager.syncAll(session, this.lighting);
  }

  private retireSession(): void {
    this.presenter?.reset();
    this.session.events.dispose();
    this.session.bus.clear();
  }

  // Menu

  private enterMenu(): void {
    this.mode = 'menu';
    this.inputLocks = 0;
    this.input.enabled = false;
    this.hud.setVisible(false);
    this.rig.root.visible = false;
    this.footageRig.root.visible = false;
    this.feedGhost.root.visible = false;
    this.listener.hide();
    this.post.fade = 0;
    void this.ui.fadeTo(0, 0.8);
    this.sceneManager.setRoom('reception', this.lighting, this.atmosphere);
    this.sceneManager.snapFog();
    this.lighting.flashlight.intensity = 0;
    this.audio.setAmbience('lobby');
    this.audio.setReverb('hall');
    this.audio.startMusic(0.5);
    this.ui.replaceAll(new MainMenu(this.menuActions()));
  }

  private menuActions() {
    return {
      canContinue: () => this.saves.latest() !== null,
      storageWarning: () => !this.storage.persistent,
      continueGame: () => {
        const latest = this.saves.latest();
        if (latest) void this.loadSlot(latest.slot);
      },
      newGame: () => this.confirmNewGame(),
      loadGame: () => this.openLoad(),
      settings: () => this.openSettings(),
      credits: () => {
        this.audio.play('ui:select', { ignoreSilence: true });
        this.ui.open(new CreditsScreen(() => this.ui.close()));
      },
    };
  }

  private confirmNewGame(): void {
    this.audio.play('ui:select', { ignoreSilence: true });
    if (!this.saves.latest()) {
      void this.startNewGame();
      return;
    }
    this.ui.open(
      new ConfirmScreen(
        'Start again from the beginning? Your saved logs are kept, but the autosave will be replaced as soon as you reach a checkpoint.',
        'Begin',
        () => void this.startNewGame(),
        () => this.ui.close(),
      ),
    );
  }

  private openSettings(): void {
    this.audio.play('ui:select', { ignoreSilence: true });
    const screen = new SettingsUI(
      this.settings,
      () => {
        this.ui.close();
        this.applyQualityIfChanged();
      },
      (name) => this.audio.play(name, { ignoreSilence: true }),
    );
    this.qualityOnOpen = this.settings.data.quality;
    this.ui.open(screen);
  }

  private qualityOnOpen = this.settings.data.quality;

  /** Render scale applies immediately. A quality change needs a reload, as it rebuilds every texture. */
  private applyQualityIfChanged(): void {
    const { quality, renderScale } = this.settings.data;
    this.renderer.setQuality(this.qualityOnOpen, renderScale);
    this.post.setSize(this.renderer.width, this.renderer.height, this.renderer.pixelRatio);
    if (quality !== this.qualityOnOpen) {
      this.ui.open(
        new ConfirmScreen(
          'Changing graphics quality rebuilds every texture, so the page has to reload. Unsaved progress since your last checkpoint will be lost.',
          'Reload Now',
          () => window.location.reload(),
          () => this.ui.close(),
        ),
      );
    }
  }

  private openLoad(): void {
    this.audio.play('ui:select', { ignoreSilence: true });
    this.ui.open(
      new SaveLoadUI(
        'load',
        this.saves,
        (slot) => void this.loadSlot(slot),
        () => this.ui.close(),
      ),
    );
  }

  // Starting and loading

  private async startNewGame(): Promise<void> {
    this.audio.play('ui:select', { ignoreSilence: true });
    this.inputLocks++;
    await this.ui.fadeTo(1, 0.7);
    this.ui.closeAll();
    this.retireSession();
    const session = new GameSession(LEVEL);
    this.bindSession(session);
    this.placePlayer(new THREE.Vector3(...LEVEL.start.pos), LEVEL.start.yaw, LEVEL.start.room);
    this.flashlightOn = true;
    this.lighting.flashlight.intensity = 0;

    this.mode = 'playing';
    this.audio.stopMusic(1.5);
    this.audio.setAmbience('wind', 1.5);
    this.ui.open(
      new CardSequence(INTRO_CARDS, () => {
        this.ui.closeAll();
        void this.beginPlay(true);
      }),
    );
    await this.ui.fadeTo(0, 0.4);
  }

  private async loadSlot(slot: SaveSlot): Promise<void> {
    const result = this.saves.load(slot);
    if (!result.ok) {
      this.audio.play('ui:error', { ignoreSilence: true });
      this.ui.open(new ConfirmScreen(`That save could not be loaded. ${result.error}.`, 'OK', () => this.ui.close(), () => this.ui.close()));
      return;
    }
    this.audio.play('ui:select', { ignoreSilence: true });
    this.inputLocks++;
    await this.ui.fadeTo(1, 0.6);
    this.ui.closeAll();
    this.retireSession();
    const session = new GameSession(LEVEL);
    // Restoring first, so that loading a save doesn't replay the story through the event bus.
    session.applySave(result.data);
    this.bindSession(session);
    const { pos, yaw, room } = result.data.checkpoint;
    this.placePlayer(new THREE.Vector3(...pos), yaw, room);
    this.flashlightOn = true;
    this.mode = 'playing';
    this.audio.startMusic(0.35);
    await this.beginPlay(false);
    if (result.recovered) this.hud.toast('The main save was damaged, so the backup was loaded.');
  }

  private placePlayer(position: THREE.Vector3, yaw: number, roomId: string): void {
    this.player.teleport(position, yaw);
    this.physics.step();
    this.session.setPlayerPose([position.x, position.y, position.z], yaw);
    this.cameraController.setZone(null);
    this.cameraController.setFocus(null, null);
    this.cameraController.snapBehind(yaw, position);
    this.moveBasisYaw = yaw;
    this.holdingBasis = false;
    this.lastZoneId = null;
    this.changeRoom(roomId);
    this.sceneManager.snapFog();
    this.rig.root.visible = true;
  }

  private async beginPlay(isNewGame: boolean): Promise<void> {
    this.inputLocks = 0;
    this.hud.setVisible(true);
    this.hud.setObjective(this.session.objectives.text);
    this.hud.setCrosshairVisible(true);
    this.input.clearPresses();
    this.input.requestPointerLock();
    await this.ui.fadeTo(0, 1.2);
    if (isNewGame) {
      this.hud.showControls(this.settings.data);
      this.audio.startMusic(0.3);
    }
  }

  private async quitToMenu(): Promise<void> {
    this.inputLocks++;
    this.input.exitPointerLock();
    await this.ui.fadeTo(1, 0.7);
    this.ui.closeAll();
    this.retireSession();
    this.bindSession(new GameSession(LEVEL));
    this.enterMenu();
  }

  // Saving

  private autosave(): void {
    if (this.mode !== 'playing' || this.session.hush.active) return;
    if (this.saves.save('auto', this.session.toSave())) this.hud.showSaving();
  }

  private saveToSlot(slot: SaveSlot): void {
    this.session.setCheckpoint('manual');
    const ok = this.saves.save(slot, this.session.toSave());
    this.ui.close();
    this.audio.play(ok ? 'ui:save' : 'ui:error', { ignoreSilence: true });
    if (ok) this.hud.showSaving();
    this.hud.toast(ok ? (this.storage.persistent ? 'Log recorded' : 'Log recorded for this session only') : 'The save failed. Browser storage may be full.');
  }

  // Screens opened from play

  private openPause(): void {
    this.audio.play('ui:open', { ignoreSilence: true });
    this.ui.open(
      new PauseMenu({
        resume: () => this.ui.close(),
        inventory: () => {
          this.ui.close();
          this.openInventory();
        },
        journal: () => {
          this.ui.close();
          this.openJournal();
        },
        load: () => this.openLoad(),
        settings: () => this.openSettings(),
        quit: () => {
          this.audio.play('ui:select', { ignoreSilence: true });
          this.ui.open(
            new ConfirmScreen(
              'Return to the title screen? Anything since your last checkpoint will be lost.',
              'Quit',
              () => void this.quitToMenu(),
              () => this.ui.close(),
            ),
          );
        },
      }),
    );
  }

  private openInventory(): void {
    this.audio.play('ui:open', { ignoreSilence: true });
    this.ui.open(
      new InventoryUI({
        session: () => this.session,
        icon: (id) => this.inspector.icon(id),
        showInspector: (id) => this.inspector.show(id),
        rotateInspector: (dx, dy) => this.inspector.rotate(dx, dy),
        openDocument: (docId) => this.openDocument(docId),
        playSound: (name) => this.audio.play(name, { ignoreSilence: true }),
        say: (text) => this.hud.say(text),
        closeKey: this.settings.data.bindings.inventory,
        onClose: () => this.ui.close(),
      }),
    );
  }

  private openJournal(): void {
    this.audio.play('paper', { ignoreSilence: true });
    this.ui.open(
      new JournalUI(
        this.session,
        this.settings.data.bindings.journal,
        (name) => this.audio.play(name, { ignoreSilence: true }),
        () => this.ui.close(),
      ),
    );
  }

  private openDocument(docId: string): void {
    const doc = DOCUMENTS[docId];
    if (!doc) return;
    if (doc.style === 'tape') {
      this.audio.play('relay:clunk', { ignoreSilence: true, volume: 0.5 });
      this.audio.play('radio:whisper', { ignoreSilence: true, volume: 0.3 });
    } else {
      this.audio.play(doc.style === 'terminal' ? 'keypad:beep' : 'paper', { ignoreSilence: true });
    }
    this.ui.open(new DocumentUI(docId, this.settings.data.bindings.interact, () => this.ui.close()));
  }

  // Interacting

  private useFocused(target: Interactable): void {
    const outcome = target.interact(this.session);
    if (outcome.type !== 'none' && outcome.type !== 'denied') {
      this.gesture = target.pose;
      this.gestureTimer = GESTURE_TIME;
    }
    this.handleOutcome(outcome);
  }

  private handleOutcome(outcome: InteractionOutcome): void {
    switch (outcome.type) {
      case 'none':
      case 'door-opened':
        break;
      case 'denied':
        this.hud.say(outcome.text);
        break;
      case 'picked-up':
        this.audio.play('pickup', { wet: 0.2 });
        break;
      case 'bag-full':
        break;
      case 'document':
        if (outcome.docId === 'cctv_playback') void this.playSecurityFootage();
        else this.openDocument(outcome.docId);
        break;
      case 'puzzle':
        this.openPuzzle(outcome.puzzleId);
        break;
      case 'post':
        this.audio.play('post:thunk', { wet: 0.3, volume: 0.5 });
        this.ui.open(new PostUI(() => this.session, (name) => this.audio.play(name, { ignoreSilence: true }), () => this.ui.close()));
        break;
      case 'recorder':
        this.audio.play('relay:clunk', { volume: 0.4 });
        this.ui.open(new SaveLoadUI('save', this.saves, (slot) => this.saveToSlot(slot), () => this.ui.close()));
        break;
      case 'examined':
        this.hud.say(outcome.text);
        break;
      case 'activated':
        this.audio.play('switch:toggle', { wet: 0.3 });
        break;
      case 'travel':
        void this.travel(outcome.def);
        break;
    }
  }

  private openPuzzle(id: Parameters<typeof createPuzzleScreen>[0]): void {
    this.audio.play('ui:open', { ignoreSilence: true });
    this.ui.open(
      createPuzzleScreen(id, {
        session: () => this.session,
        playSound: (name) => this.audio.play(name, { ignoreSilence: true }),
        close: () => this.ui.close(),
        closeAfter: (seconds) => {
          const screen = this.ui.top;
          window.setTimeout(() => {
            if (this.ui.top === screen) this.ui.close();
          }, seconds * 1000);
        },
      }),
    );
  }

  /** The lift and service stair: both cross to somewhere new behind a short black interval. */
  private async travel(def: Extract<InteractableDef, { kind: 'travel' }>): Promise<void> {
    this.inputLocks++;
    this.hud.setVisible(false);
    await this.ui.fadeTo(1, 0.7);
    const isLift = def.style === 'lift';
    this.audio.play(isLift ? 'lift:move' : 'stairs:climb', { ignoreSilence: true, volume: 0.8 });
    const overlay = el('div', 'travel-bars');
    if (isLift) {
      for (let i = 0; i < 4; i++) {
        const bar = el('i');
        bar.style.animationDelay = `${i * 0.29}s`;
        overlay.append(bar);
      }
    }
    const label = el('div', 'travel-label', isLift ? 'Goods lift' : 'Service stair');
    this.ui.layer.append(overlay, label);

    const { room, pos, yaw } = def.to;
    this.placePlayer(new THREE.Vector3(...pos), yaw, room);
    await wait(isLift ? 3.6 : 2.4);
    overlay.remove();
    label.remove();
    this.hud.setVisible(true);
    this.inputLocks--;
    await this.ui.fadeTo(0, 0.9);
  }

  /** Being caught doesn't cost any progress, but it does put the player back where they were. */
  private async wakeFromCaught(): Promise<void> {
    this.inputLocks++;
    this.hud.clearSubtitles();
    await this.ui.fadeTo(1, 0.5);
    const { checkpoint } = this.session;
    this.placePlayer(new THREE.Vector3(...checkpoint.pos), checkpoint.yaw, checkpoint.room);
    this.player.crouching = false;
    await wait(1.6);
    this.inputLocks--;
    await this.ui.fadeTo(0, 1.4);
    this.hud.say('...I was on the floor. How long was I on the floor?', 4);
  }

  /** The story's turning point: the footage plays across every monitor, before the transcript. */
  private async playSecurityFootage(): Promise<void> {
    this.inputLocks++;
    this.hud.setVisible(false);
    this.footageTime = 0;
    this.footageRig.root.visible = true;
    this.feeds.startPlayback(CCTV_PLAYBACK_TIME);
    this.audio.play('relay:clunk', { ignoreSilence: true });
    this.audio.play('radio:whisper', { ignoreSilence: true, volume: 0.3 });

    const center = this.feeds.monitorCenter;
    this.cameraController.setFocus(new THREE.Vector3(center.x, center.y + 0.05, center.z - 2.5), center);
    await wait(CCTV_PLAYBACK_TIME);
    this.footageRig.root.visible = false;
    this.cameraController.setFocus(null, null);
    this.hud.setVisible(true);
    this.inputLocks--;
    this.openDocument('cctv_playback');
  }

  // Endings

  private async playEnding(ending: EndingId): Promise<void> {
    if (this.mode === 'ending') return;
    this.mode = 'ending';
    this.inputLocks++;
    this.input.enabled = false;
    this.input.exitPointerLock();
    this.interaction.clear();
    this.hud.prompt.hide();

    if (ending === 'answer') {
      await this.playAnswerEnding();
    } else {
      this.audio.setAmbience('wind', 4);
      await this.ui.fadeTo(1, 4, true);
      await wait(1);
    }

    this.hud.setVisible(false);
    const text = ENDINGS[ending];
    const documentsTotal = Object.keys(DOCUMENTS).length;
    this.ui.replaceAll(
      new EndingScreen(
        text.title,
        text.lines,
        { time: this.session.playtime, documents: this.session.journal.discovered.length, documentsTotal, label: text.label },
        () => void this.quitToMenu(),
      ),
    );
    this.audio.stopMusic(3);
    this.audio.setAmbience(ending === 'answer' ? 'annex' : 'dawn', 4);
    await this.ui.fadeTo(0, 2);
  }

  private async playAnswerEnding(): Promise<void> {
    const mic = new THREE.Vector3(-38.1, -12.45, -8.4);
    const position = this.player.position;
    this.cameraController.setFocus(new THREE.Vector3(position.x - 1.3, position.y + 1.4, position.z + 1.4), mic);
    this.lighting.setMaster(0.25);
    this.audio.setSilence(0.9);
    this.post.silence = 0.5;
    this.hud.clearSubtitles();
    await wait(2.4);
    for (const line of ANSWER_LINES) {
      this.audio.play('radio:whisper', { ignoreSilence: true, volume: 0.28 });
      this.hud.say(line, Math.max(3.2, line.length * 0.075));
      await wait(Math.max(3.2, line.length * 0.075) + 0.4);
    }
    this.audio.play('radio:burst', { ignoreSilence: true, volume: 0.9 });
    await wait(1);
    await this.ui.fadeTo(1, 3);
    await wait(1.2);
    this.lighting.setMaster(1);
  }

  // Main loop

  private get controlling(): boolean {
    return this.mode === 'playing' && !this.ui.blocking && this.inputLocks === 0;
  }

  private fixedUpdate(dt: number): void {
    if (this.mode !== 'playing' || this.ui.blocking) return;

    const axis = this.input.moveAxis();
    const hush = this.session.hush;
    const caught = hush.phase === 'caught';
    this.player.frozen = this.inputLocks > 0 || caught;

    // Input direction stays as it was while the camera is moving to a new zone, so that
    // holding W keeps walking the same way, instead of suddenly turning a corner.
    if (!this.holdingBasis) {
      this.moveBasisYaw = this.cameraController.inZone ? this.cameraController.viewYaw : this.cameraController.yaw;
    } else if (axis.x === 0 && axis.y === 0) {
      this.holdingBasis = false;
    }

    this.player.fixedUpdate(dt, {
      x: axis.x,
      y: axis.y,
      basisYaw: this.moveBasisYaw,
      run: this.input.running,
      toggleCrouch: this.pendingCrouch && this.inputLocks === 0,
    });
    this.pendingCrouch = false;
    this.physics.step();

    const { position } = this.player;
    this.session.setPlayerPose([position.x, position.y, position.z], this.player.yaw);
    const roomId = this.sceneManager.findRoomAt(position);
    if (roomId && roomId !== this.session.currentRoom) this.changeRoom(roomId);

    this.session.playtime += dt;
    this.session.events.update(dt, this.session.playerPos, this.session.currentRoom);
    const distance = this.listener.visible ? this.listener.position.distanceTo(position) : 12;
    hush.update(dt, this.player.noise, distance);
    this.session.suspense.update(dt, {
      roomId: this.session.currentRoom,
      wing: this.session.room().wing,
      hushActive: hush.active,
      noise: this.player.noise,
    });
    this.session.updateFlashlight(dt, this.flashlightOn);
  }

  private changeRoom(roomId: string): void {
    const room = this.session.room(roomId);
    this.sceneManager.setRoom(roomId, this.lighting, this.atmosphere);
    this.sceneManager.syncConditions(this.session, this.lighting);
    this.audio.setAmbience(room.ambience);
    this.audio.setReverb(room.reverb);
    this.session.enterRoom(roomId);
  }

  private onFootstep(): void {
    const room = this.session.room();
    // In a Hush, she can't hear even her own boots: it's the first thing players notice.
    const loudness = (this.player.crouching ? 0.22 : this.player.speed > 2.6 ? 0.85 : 0.5) * (this.session.hush.active ? 0.2 : 1);
    this.audio.footstep(room.surface, loudness);
  }

  private update(dt: number): void {
    this.simulateFrame(dt);
    this.render(dt);
    if (this.renderer.trackFrame(dt)) this.post.setSize(this.renderer.width, this.renderer.height, this.renderer.pixelRatio);
  }

  private simulateFrame(dt: number): void {
    this.time += dt;
    this.input.pollGamepad();
    this.ui.update(dt);

    if (this.mode === 'menu' || this.mode === 'booting') {
      this.updateMenuView(dt);
      return;
    }

    const controlling = this.controlling;
    this.input.enabled = controlling;
    this.hud.setMouseHint(controlling && this.hadPointerLock && document.pointerLockElement === null);
    const look = this.input.consumeLook();
    if (controlling) {
      this.cameraController.applyLook(look.x, look.y);
      this.handlePlayInput();
    }

    if (!this.ui.blocking) this.updateWorld(dt);
  }

  private handlePlayInput(): void {
    if (this.input.consumePress('pause')) {
      this.openPause();
      return;
    }
    if (this.input.consumePress('inventory')) {
      this.openInventory();
      return;
    }
    if (this.input.consumePress('journal')) {
      this.openJournal();
      return;
    }
    if (this.input.consumePress('crouch')) this.pendingCrouch = true;
    if (this.input.consumePress('flashlight')) {
      this.flashlightOn = !this.flashlightOn;
      this.audio.play('flashlight');
    }
    if (this.input.consumePress('interact') && this.interaction.focused) {
      this.useFocused(this.interaction.focused);
    }
  }

  private updateWorld(dt: number): void {
    const playerPos = this.player.interpolated(1, this.interpolated);
    this.rig.root.position.copy(playerPos);
    this.rig.root.rotation.y = this.player.yaw;

    this.updateCameraZone();
    const crouch = this.player.crouching ? 1 : 0;
    this.cameraController.update(dt, playerPos, crouch);

    // Aim: along the view normally, or wherever she's facing when the camera is off the shoulder.
    const inZone = this.cameraController.inZone;
    if (inZone) tempAim.set(-Math.sin(this.player.yaw), 0, -Math.cos(this.player.yaw));
    else this.cameraController.aimDirection(tempAim);

    if (this.gestureTimer > 0) {
      this.gestureTimer -= dt;
      if (this.gestureTimer <= 0) this.gesture = 'none';
    }
    const aimYaw = inZone ? 0 : shortestAngle(this.player.yaw, this.cameraController.yaw);
    if (!inZone && this.player.speed < 0.1 && Math.abs(aimYaw) > 1.15) this.player.faceToward(this.cameraController.yaw, dt);
    this.animation.update(dt, {
      speed: this.player.speed,
      crouch,
      aimPitch: inZone ? 0 : this.cameraController.pitch,
      aimYaw,
      aiming: this.flashlightOn,
      gesture: this.gesture,
    });

    this.updateTorch(dt);
    this.updateInteraction(dt, playerPos);

    this.sceneManager.update(dt);
    this.lighting.update(dt, playerPos);
    this.lighting.fill.position.copy(this.cameraController.camera.position);
    const { hush } = this.session;
    this.listener.update(dt, playerPos, hush.progress);
    this.atmosphere.update(this.time, this.cameraController.camera.position, this.renderer.pixelRatio);
    const distance = this.listener.visible ? this.listener.position.distanceTo(playerPos) : 20;
    this.presenter?.update(dt, distance);

    // Hides her when the camera has been pushed right up against her by a wall.
    this.rig.root.visible = this.cameraController.distanceToHead(playerPos) > 0.42;

    this.cameraController.camera.getWorldDirection(tempForward);
    this.audio.updateListener(this.cameraController.camera.position, tempForward);
    this.hud.update(dt, this.session.battery, this.player.noise);

    if (this.session.currentRoom === 'security') this.updateFeeds(dt);
  }

  private updateCameraZone(): void {
    const { position } = this.player;
    const zone = this.settings.data.cinematicCameras ? this.zones.find(this.session.currentRoom, position.x, position.z) : null;
    const id = zone?.id ?? null;
    if (id === this.lastZoneId) return;
    // Leaving a composed shot, take up the orbit from wherever that shot was looking.
    if (!zone && this.lastZoneId) this.cameraController.yaw = this.cameraController.viewYaw;
    this.lastZoneId = id;
    this.cameraController.setZone(zone);
    this.holdingBasis = true;
  }

  private updateTorch(dt: number): void {
    const { flashlight } = this.lighting;
    this.rig.handR.getWorldPosition(tempHand);
    // The light comes from just ahead of the hand, and slightly above it to catch the floor.
    flashlight.position.copy(tempHand).addScaledVector(tempAim, 0.14);
    flashlight.target.position.copy(tempHand).addScaledVector(tempAim, 12);
    flashlight.target.updateMatrixWorld();

    // A battery on its way out flickers, and at empty only a dim glow remains.
    const battery = this.session.battery;
    let level = 0;
    if (this.flashlightOn) {
      level = battery <= 0 ? TORCH_DEAD_LEVEL : 0.22 + 0.78 * Math.min(1, battery / 25);
      if (battery > 0 && battery < 12 && Math.sin(this.time * 19) * Math.sin(this.time * 7.3) > 0.55) level *= 0.35;
    }
    this.torchLevel += (level - this.torchLevel) * (1 - Math.exp(-22 * dt));
    flashlight.intensity = TORCH_INTENSITY * this.torchLevel;
  }

  private updateInteraction(dt: number, playerPos: THREE.Vector3): void {
    if (!this.controlling) {
      this.interaction.clear();
      this.hud.prompt.hide();
      return;
    }
    const eye = this.player.crouching ? 0.95 : 1.5;
    this.interaction.update(dt, this.session, playerPos, tempAim, eye);
    const focused = this.interaction.focused;
    if (focused) {
      this.hud.prompt.show(focused.prompt(this.session), focused.isBlocked(this.session), this.settings.data.bindings.interact, focused.position, this.cameraController.camera);
    } else {
      this.hud.prompt.hide();
    }
  }

  private updateFeeds(dt: number): void {
    if (this.feeds.playingBack) this.updateFootage(dt);
    const ghostOn = this.session.check({ flag: 'saw_cctv' });
    this.feeds.update(
      dt,
      this.sceneManager.scene,
      (view) => {
        this.sceneManager.applyRoomVisibility(view.rooms);
        this.lighting.beginFeedLighting();
        this.sceneManager.scene.fog = null;
        this.rig.root.visible = false;
        this.feedGhost.root.visible = ghostOn && view.label === 'LEVEL C';
      },
      () => {
        const room = this.session.room();
        this.sceneManager.applyRoomVisibility([room.id, ...room.visible]);
        this.lighting.endFeedLighting();
        this.sceneManager.scene.fog = this.sceneManager.fogObject;
        this.rig.root.visible = true;
        this.feedGhost.root.visible = false;
      },
    );
  }

  /** Walks the figure on the tape down the corridor, stopping under the camera to look up. */
  private updateFootage(dt: number): void {
    this.footageTime += dt;
    const t = this.footageTime;
    const root = this.footageRig.root;
    const stopX = -6.6;
    const walking = t < 3.2 || t > 6.4;
    const x = t < 3.2 ? -15.5 + (t / 3.2) * (stopX + 15.5) : t <= 6.4 ? stopX : stopX + (t - 6.4) * 1.2;
    root.position.set(x, 0, 6.3);
    root.rotation.y = -Math.PI / 2;
    this.footageAnimation.update(dt, {
      speed: walking ? 1.2 : 0,
      crouch: 0,
      aimPitch: !walking ? 0.55 : 0,
      aimYaw: !walking ? 0.5 : 0,
      aiming: false,
      gesture: 'none',
    });
  }

  private updateMenuView(dt: number): void {
    this.menuCameraTime += dt;
    const t = this.menuCameraTime * 0.05;
    const { camera } = this.cameraController;
    camera.position.set(Math.sin(t) * 3.2 - 1.4, 2.2 + Math.sin(t * 1.7) * 0.25, 18.6 + Math.cos(t) * 0.7);
    camera.lookAt(1.2 + Math.sin(t * 0.8) * 1.4, 2.4, 9);
    tempPlayer.copy(camera.position);
    this.sceneManager.update(dt);
    this.lighting.update(dt, tempPlayer);
    this.lighting.fill.position.copy(camera.position);
    this.atmosphere.update(this.time, camera.position, this.renderer.pixelRatio);
  }

  private render(dt: number): void {
    if (this.inspector.active) {
      this.inspector.render(dt, this.renderer.width, this.renderer.height);
      return;
    }
    this.post.render(this.time, dt);
  }

  /** Releases everything the game holds on to. Used when the page is hot-reloaded during development. */
  dispose(): void {
    this.loop.dispose();
    this.input.dispose();
    this.retireSession();
    this.presenter?.dispose();
    this.audio.dispose();
    this.feeds?.dispose();
    this.inspector?.dispose();
    this.listener?.dispose();
    this.atmosphere?.dispose();
    this.lighting?.dispose();
    this.post?.dispose();
    this.sceneManager?.dispose();
    this.materials?.dispose();
    this.physics?.dispose();
    this.renderer?.dispose();
  }

  /** Access for automated checks. main.ts only exposes this on the development server. */
  get debug() {
    return {
      session: () => this.session,
      player: () => this.player,
      camera: () => this.cameraController,
      ui: () => this.ui,
      interaction: () => this.interaction,
      renderer: () => this.renderer.three,
      scene: () => this.sceneManager,
      listener: () => this.listener,
      mode: () => this.mode,
      startNewGame: () => this.startNewGame(),
      loadSlot: (slot: SaveSlot) => this.loadSlot(slot),
      teleport: (x: number, y: number, z: number, yaw = 0) => {
        const position = new THREE.Vector3(x, y, z);
        const room = this.sceneManager.findRoomAt(position);
        if (!room) throw new Error(`No room at ${x},${y},${z}`);
        this.placePlayer(position, yaw, room);
      },
      look: (yaw: number, pitch: number) => {
        this.cameraController.yaw = yaw;
        this.cameraController.pitch = pitch;
      },
      useFocused: () => {
        if (this.interaction.focused) this.useFocused(this.interaction.focused);
        return this.interaction.focused?.id ?? null;
      },
      use: (id: string) => {
        const target = this.interaction.find(id);
        if (!target) throw new Error(`No interactable ${id}`);
        this.useFocused(target);
      },
      setFlashlight: (on: boolean) => {
        this.flashlightOn = on;
      },
      lockState: () => ({ inputLocks: this.inputLocks, blocking: this.ui.blocking }),
      /** Runs the game forward as fast as possible, then draws one frame. Works with a hidden tab. */
      advance: (seconds: number, draw = true) => {
        const step = 1 / 60;
        for (let t = 0; t < seconds; t += step) {
          this.fixedUpdate(step);
          this.simulateFrame(step);
        }
        if (draw) this.render(step);
      },
      move: (x: number, y: number, run = false) => {
        this.input.scriptedMove = x === 0 && y === 0 ? null : { x, y, run };
      },
      crouch: () => {
        this.pendingCrouch = true;
      },
      settings: () => this.settings,
      feeds: () => this.feeds,
      post: () => this.post,
      lighting: () => this.lighting,
      lockResolution: (scale: number) => {
        this.renderer.lockDynamicScale(scale);
        this.post.setSize(this.renderer.width, this.renderer.height, this.renderer.pixelRatio);
      },
      /** True GPU time per frame, from the graphics driver's own timer. Works with a hidden tab. */
      measureGpu: async (frames = 6) => {
        const gl = this.renderer.three.getContext() as WebGL2RenderingContext;
        const timer = gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if (!timer) return null;
        const queries: WebGLQuery[] = [];
        for (let i = 0; i < frames; i++) {
          const query = gl.createQuery();
          gl.beginQuery(timer.TIME_ELAPSED_EXT, query);
          this.simulateFrame(1 / 60);
          this.render(1 / 60);
          gl.endQuery(timer.TIME_ELAPSED_EXT);
          queries.push(query);
          await wait(0.03);
        }
        await wait(0.3);
        const results: number[] = [];
        for (const query of queries) {
          if (gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) results.push(gl.getQueryParameter(query, gl.QUERY_RESULT) / 1e6);
          gl.deleteQuery(query);
        }
        results.sort((a, b) => a - b);
        return results.length ? Math.round(results[Math.floor(results.length / 2)] * 10) / 10 : null;
      },
      /** Synthesizes every sound and reports its level. Sound can't be judged by eye, but broken sound can. */
      auditSounds: () => {
        const context = new OfflineAudioContext(1, 44100, 44100);
        const bank = new SoundBank(context);
        return SoundBank.names.map((name) => {
          const data = (bank.get(name) as AudioBuffer).getChannelData(0);
          let peak = 0;
          let sum = 0;
          let broken = false;
          for (let i = 0; i < data.length; i++) {
            const value = data[i];
            if (!Number.isFinite(value)) broken = true;
            const magnitude = Math.abs(value);
            if (magnitude > peak) peak = magnitude;
            sum += value * value;
          }
          return { name, peak: Math.round(peak * 100) / 100, rms: Math.round(Math.sqrt(sum / data.length) * 1000) / 1000, seconds: Math.round((data.length / 44100) * 10) / 10, broken };
        });
      },
      audioState: () => this.audio.debugState(),
      /**
       * Measures how long frames really take, by forcing the GPU to finish each one.
       * Unlike counting animation frames, this still works while the tab is throttled.
       */
      measureFrames: (count = 8) => {
        const three = this.renderer.three;
        const gl = three.getContext();
        const pixel = new Uint8Array(4);
        const durations: number[] = [];
        let info = { calls: 0, triangles: 0 };
        three.info.autoReset = false;
        for (let i = 0; i < count; i++) {
          three.info.reset();
          const start = performance.now();
          this.simulateFrame(1 / 60);
          this.render(1 / 60);
          gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
          durations.push(performance.now() - start);
          info = { calls: three.info.render.calls, triangles: three.info.render.triangles };
        }
        three.info.autoReset = true;
        durations.sort((a, b) => a - b);
        const median = durations[Math.floor(durations.length / 2)];
        return {
          medianMs: Math.round(median * 10) / 10,
          fps: Math.round(1000 / median),
          ...info,
          textures: three.info.memory.textures,
          geometries: three.info.memory.geometries,
          buffer: [gl.drawingBufferWidth, gl.drawingBufferHeight],
        };
      },
    };
  }
}
