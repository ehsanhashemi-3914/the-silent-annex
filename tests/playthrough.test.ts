// Plays the entire game through the logic layer, using the same code the real game
// calls when the player presses E. If this passes, the story can be finished.

import { describe, expect, it } from 'vitest';
import { GameSession } from '../src/core/GameSession';
import type { Vec3 } from '../src/core/Script';
import { useDoor, useInteractable, type InteractionOutcome } from '../src/interaction/InteractionLogic';
import { ArchivePuzzle } from '../src/puzzles/ArchivePuzzle';
import { SaveManager, type StorageBackend } from '../src/saving/SaveManager';
import type { InteractableDef } from '../src/world/LevelDefinition';
import { LEVEL, ROOM_IDS } from '../src/world/levels';

const interactables = new Map<string, InteractableDef>(
  LEVEL.rooms.flatMap((room) => room.interactables.map((def) => [def.id, def] as const)),
);

class Player {
  session = new GameSession(LEVEL, () => 0.5);

  constructor() {
    this.session.enterRoom(LEVEL.start.room);
  }

  /** Walks to a room, standing at its centre, and advances time so triggers fire. */
  goto(roomId: string, pos?: Vec3) {
    const room = this.session.room(roomId);
    const [x0, z0, x1, z1] = room.rect;
    this.session.enterRoom(roomId);
    this.session.setPlayerPose(pos ?? [(x0 + x1) / 2, room.floorY, (z0 + z1) / 2], 0);
    this.tick(0.1);
  }

  /** Stands in a position within the current room, so zone triggers can fire. */
  stand(pos: Vec3) {
    this.session.setPlayerPose(pos, 0);
    this.tick(0.1);
  }

  tick(seconds: number) {
    for (let t = 0; t < seconds; t += 0.1) {
      this.session.events.update(0.1, this.session.playerPos, this.session.currentRoom);
    }
  }

  use(id: string): InteractionOutcome {
    const def = interactables.get(id);
    if (!def) throw new Error(`No interactable ${id}`);
    return useInteractable(this.session, def);
  }

  door(id: string): InteractionOutcome {
    const door = this.session.door(id);
    if (!door) throw new Error(`No door ${id}`);
    return useDoor(this.session, door, this.session.currentRoom);
  }

  /** Waits out a Hush by standing perfectly still. */
  surviveHush() {
    expect(this.session.hush.active).toBe(true);
    for (let t = 0; t < 60 && this.session.hush.active; t += 0.1) this.session.hush.update(0.1, 0, 8);
    expect(this.session.hush.active).toBe(false);
  }

  /** Plays from the very start to just before the final choice. */
  playToTheAnnex() {
    const s = this.session;

    // Act 1: arrival
    expect(this.door('d_entrance').type).toBe('door-opened');
    this.goto('mainEntrance');
    this.stand([0, 0, 24]);
    expect(s.check({ flag: 'entrance_sealed' })).toBe(true);
    expect(this.door('d_entrance').type).toBe('denied');
    expect(s.objectives.currentId).toBe('reception');

    this.goto('reception');
    expect(this.door('d_restricted').type).toBe('denied');
    expect(this.door('d_admin').type).toBe('denied');
    this.use('rd_visitor_log');
    this.use('ex_plaque');
    this.tick(8);
    expect(s.check({ flag: 'phone_ringing' })).toBe(true);
    this.use('sw_phone');

    this.goto('waiting');
    expect(this.use('pk_admin_key').type).toBe('picked-up');
    this.use('pk_battery_waiting');
    this.use('rd_protocol_h');
    expect(this.use('tr_stairs_up_side').type).toBe('denied');

    this.goto('reception');
    expect(this.door('d_admin').type).toBe('door-opened');
    expect(s.inventory.has('admin_key')).toBe(false);

    this.goto('admin');
    expect(s.objectives.currentId).toBe('records');
    this.use('rd_memo_code');
    expect(this.door('d_records').type).toBe('puzzle');
    expect(s.puzzles.enterCode('records_keypad', '0000')).toBe(false);
    expect(s.puzzles.enterCode('records_keypad', '1961')).toBe(true);
    expect(s.openDoors.has('d_records')).toBe(true);

    this.goto('records');
    this.use('pk_security_card');
    this.use('sw_floorplan');
    expect(s.objectives.currentId).toBe('card');
    expect(this.door('d_hatch').type).toBe('denied');

    // Act 2: the research wing
    this.goto('admin');
    this.goto('reception');
    this.tick(1);
    expect(s.check({ flag: 'glimpse_gallery' })).toBe(true);
    expect(this.door('d_restricted').type).toBe('door-opened');

    this.goto('labCorridor', [0, 0, 6]);
    expect(s.objectives.currentId).toBe('power');
    expect(this.door('d_observation').type).toBe('denied');
    expect(this.door('d_electrical').type).toBe('door-opened');

    this.goto('electrical');
    this.use('rd_aune');
    expect(s.objectives.currentId).toBe('fuse');
    // The fuse isn't here yet, so the panel has to refuse it.
    expect(s.puzzles.seatFuse()).toBe(false);
    expect(s.puzzles.energise()).toBe('no-fuse');

    this.goto('labCorridor', [-12, 0, 6]);
    expect(this.door('d_research').type).toBe('door-opened');
    this.goto('research');
    this.use('pk_storage_key');
    this.use('rd_research_notes');
    this.use('tp_olander');

    this.goto('labCorridor', [-5, 0, 6]);
    this.goto('junction');
    this.use('st_research_post');
    expect(this.door('d_lab').type).toBe('denied');
    expect(this.door('d_storage').type).toBe('door-opened');

    this.goto('storage');
    this.use('pk_fuse');
    this.use('rd_night_log_2');
    expect(s.objectives.currentId).toBe('energise');
    expect(this.door('d_hatch').type).toBe('door-opened');

    // Walking back triggers the first Hush.
    this.goto('junction');
    this.goto('labCorridor', [5, 0, 6]);
    this.surviveHush();
    expect(s.check({ flag: 'hush_h1_done' })).toBe(true);

    this.goto('electrical');
    expect(s.puzzles.seatFuse()).toBe(true);
    expect(s.inventory.has('fuse_30a')).toBe(false);
    s.puzzles.toggleBreaker('west');
    s.puzzles.toggleBreaker('reserve');
    s.puzzles.toggleBreaker('main');
    s.puzzles.toggleBreaker('east');
    expect(s.puzzles.energise()).toBe('solved');
    expect(s.check({ flag: 'main_power' })).toBe(true);
    expect(s.objectives.currentId).toBe('observation');

    this.goto('labCorridor', [-2, 0, 6]);
    expect(this.door('d_observation').type).toBe('door-opened');
    this.goto('observation');
    this.use('rd_test44');
    this.use('sw_lab_release');
    expect(s.check({ flag: 'lab_release' })).toBe(true);

    this.goto('labCorridor', [5, 0, 6]);
    this.goto('junction');
    expect(this.door('d_lab').type).toBe('door-opened');
    this.goto('restrictedLab');
    this.use('rd_hana_lab');
    this.use('pk_lift_key');
    this.use('pk_research_notes');
    expect(this.door('d_labLift').type).toBe('door-opened');
    this.goto('liftLobby');
    expect(this.use('tr_lift_down').type).toBe('travel');

    // Act 3: Level C
    this.goto('liftLanding');
    this.tick(1);
    expect(s.objectives.currentId).toBe('archive');
    this.goto('underCorridor', [0, -14, -9.5]);
    this.use('rd_archive_guide');
    expect(this.door('d_archive').type).toBe('denied');
    expect(this.door('d_security').type).toBe('denied');
    expect(this.door('d_annex').type).toBe('denied');

    expect(s.puzzles.pullArchiveLever()).toBe(false);
    ArchivePuzzle.SOLUTION.forEach((value, i) => {
      for (let step = 0; step < value; step++) s.puzzles.rotateDial(i, 1);
    });
    expect(s.puzzles.pullArchiveLever()).toBe(true);
    expect(s.openDoors.has('d_archive')).toBe(true);
    expect(s.objectives.currentId).toBe('reel');

    this.goto('archive');
    this.use('pk_reel');
    this.use('rd_procedure_b');
    expect(s.objectives.currentId).toBe('security');
    this.use('pk_security_key');
    this.tick(0.2);
    this.surviveHush();

    this.goto('underCorridor', [-17, -14, -9.5]);
    expect(this.door('d_security').type).toBe('door-opened');
    this.goto('security');
    expect(this.use('tp_cctv').type).toBe('document');
    expect(s.inventory.has('test44_reel')).toBe(false);
    expect(s.objectives.currentId).toBe('systems');
    this.use('rd_procedure_c');
    this.use('rd_director_final');
    expect(s.objectives.currentId).toBe('ignition');

    // Going back up for the key
    this.goto('underCorridor', [2, -14, -8.3]);
    this.use('rd_procedure_a');
    this.use('sw_unbolt_stairs');
    expect(this.use('tr_stairs_up').type).toBe('travel');
    this.goto('waiting');
    expect(s.check({ flag: 'clock_changed' })).toBe(true);
    this.goto('reception');
    this.goto('admin');
    expect(s.puzzles.enterCode('director_safe', '1410')).toBe(true);
    this.use('pk_ignition_key');
    expect(s.objectives.currentId).toBe('return');

    this.goto('reception', [9, 0, 17.5]);
    this.surviveHush();
    expect(s.check({ flag: 'chairs_moved' })).toBe(true);

    this.goto('waiting');
    this.goto('underCorridor', [2, -14, -8.3]);
    this.goto('security');
    expect(s.objectives.currentId).toBe('systems2');

    // Puzzle C, making one realistic mistake first
    expect(s.puzzles.insertIgnitionKey()).toBe(true);
    expect(s.puzzles.operateCentral('generator')).toBe('fault-overtemp');
    this.goto('underCorridor', [-21, -14, -9.5]);
    this.use('sw_coolant');
    this.goto('security');
    expect(s.puzzles.operateCentral('generator')).toBe('ok');
    expect(s.puzzles.operateCentral('dampers')).toBe('fault-airflow');
    expect(s.puzzles.operateCentral('generator')).toBe('ok');
    expect(s.puzzles.operateCentral('ventilation')).toBe('ok');
    expect(s.puzzles.operateCentral('dampers')).toBe('ok');
    expect(s.puzzles.operateCentral('release')).toBe('ok');
    expect(s.objectives.currentId).toBe('annex');

    this.goto('underCorridor', [-24, -14, -9.5]);
    expect(this.door('d_annex').type).toBe('door-opened');
    this.goto('annex');
    this.tick(2);
    expect(s.objectives.currentId).toBe('source');
    expect(this.door('d_exit').type).toBe('denied');
    expect(interactables.get('sw_speak')?.kind).toBe('switch');
    this.use('tp_hana_final');
    expect(s.journal.has('hana_final')).toBe(true);
  }
}

describe('a complete playthrough', () => {
  it('reaches the SILENCE ending by cutting the signal and walking out', () => {
    const player = new Player();
    player.playToTheAnnex();
    const s = player.session;
    expect(player.use('sw_cut').type).toBe('activated');
    expect(s.objectives.currentId).toBe('leave');
    expect(player.door('d_exit').type).toBe('door-opened');
    // The microphone can't be used after the signal has been cut.
    expect(player.use('sw_speak').type).toBe('none');
    player.goto('exitTunnel', [-60, -14, -9.5]);
    expect(s.ending).toBeNull();
    player.stand([-80, -14, -9.5]);
    expect(s.ending).toBe('silence');
  });

  it('reaches the ANSWER ending by speaking into the microphone', () => {
    const player = new Player();
    player.playToTheAnnex();
    player.use('sw_speak');
    expect(player.session.ending).toBe('answer');
  });

  it('survives a save and reload halfway through', () => {
    const data = new Map<string, string>();
    const storage: StorageBackend = {
      getItem: (key) => data.get(key) ?? null,
      setItem: (key, value) => void data.set(key, value),
      removeItem: (key) => void data.delete(key),
    };
    const manager = new SaveManager(storage, ROOM_IDS);

    const first = new Player();
    first.door('d_entrance');
    first.goto('mainEntrance');
    first.stand([0, 0, 24]);
    first.goto('reception');
    first.goto('waiting');
    first.use('pk_admin_key');
    expect(manager.save('slot1', first.session.toSave())).toBe(true);

    const loaded = manager.load('slot1');
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;

    const second = new Player();
    second.session.applySave(loaded.data);
    const s = second.session;
    expect(s.inventory.has('admin_key')).toBe(true);
    expect(s.check({ flag: 'entrance_sealed' })).toBe(true);
    // A collected pickup stays collected, and fired triggers stay fired.
    expect(second.use('pk_admin_key').type).toBe('none');
    expect(s.events.fired.has('t_sealed')).toBe(true);
    // And the game carries on from there.
    second.goto('reception');
    expect(second.door('d_admin').type).toBe('door-opened');
  });

  it('never loses a pickup when the bag is full', () => {
    const player = new Player();
    const s = player.session;
    player.goto('waiting');
    for (let i = 0; i < 8; i++) s.inventory.add('battery');
    expect(player.use('pk_admin_key').type).toBe('bag-full');
    expect(s.inventory.has('admin_key')).toBe(false);
    // Free a slot through the pneumatic post and the coat is still there to search.
    s.inventory.sendToStorage(0);
    expect(player.use('pk_admin_key').type).toBe('picked-up');
    expect(s.inventory.has('admin_key')).toBe(true);
  });

  it('wakes the player up after being caught, then gives way the second time', () => {
    const player = new Player();
    const s = player.session;
    s.setFlag('hush_h1_armed');
    s.hush.start('h1');
    for (let t = 0; t < 30 && s.hush.active; t += 0.1) s.hush.update(0.1, t > 3 ? 1 : 0, 2);
    expect(s.hushAttempts.h1).toBe(1);
    expect(s.check({ flag: 'hush_h1_done' })).toBe(false);
    s.hush.start('h1');
    for (let t = 0; t < 30 && s.hush.active; t += 0.1) s.hush.update(0.1, t > 3 ? 1 : 0, 2);
    expect(s.check({ flag: 'hush_h1_done' })).toBe(true);
  });

  it('keeps the torch battery within range and refills it from an item', () => {
    const player = new Player();
    const s = player.session;
    s.updateFlashlight(100000, true);
    expect(s.battery).toBe(0);
    s.inventory.add('battery');
    expect(s.useItem('battery').used).toBe(true);
    expect(s.battery).toBe(50);
    expect(s.inventory.has('battery')).toBe(false);
    expect(s.useItem('battery').used).toBe(false);
  });
});
