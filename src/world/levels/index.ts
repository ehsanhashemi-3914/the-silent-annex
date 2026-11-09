// Assembles the three wings into the full level and defines how they play out over time.

import type { Action, PuzzleId } from '../../core/Script';
import type { CameraZoneDef, LevelData, TriggerDef } from '../LevelDefinition';
import { archiveDoors, archiveLinks, archiveRooms } from './archive';
import { receptionDoors, receptionLinks, receptionRooms } from './reception';
import { researchDoors, researchLinks, researchRooms } from './research';

const puzzleRewards: Record<PuzzleId, Action[]> = {
  records_keypad: [{ unlock: 'd_records' }, { open: 'd_records' }, { cue: 'keypad:ok' }, { checkpoint: 'records' }],
  director_safe: [{ cue: 'safe:open' }, { say: 'It opens. A heavy brass key, sitting on a single sheet of paper. The sheet is blank.' }],
  electrical: [
    { set: 'main_power' },
    { objective: 'observation' },
    { cue: 'power:restore' },
    { script: 'lights:restore' },
    { say: "There it is. The whole wing's coming up. The observation room's mag-lock should release now." },
    { checkpoint: 'power' },
  ],
  archive: [
    { unlock: 'd_archive' },
    { open: 'd_archive' },
    { objective: 'reel' },
    { cue: 'lever:ok' },
    { say: 'Something heavy moves behind the wall, and the door gives.' },
    { checkpoint: 'archive' },
  ],
  central: [
    { set: 'annex_release' },
    { set: 'deep_power' },
    { unlock: 'd_annex' },
    { objective: 'annex' },
    { cue: 'annex:release' },
    { script: 'lights:restore' },
    { say: 'Somewhere at the end of the corridor, a great many bolts have just let go at once.' },
    { checkpoint: 'annex' },
  ],
};

const triggers: TriggerDef[] = [
  // Arrival
  {
    id: 't_sealed',
    when: { zone: [-4.5, 22, 4.5, 26.2], room: 'mainEntrance' },
    actions: [
      { close: 'd_entrance' },
      { set: 'entrance_sealed' },
      { cue: 'door:slam' },
      { objective: 'reception' },
      { say: "The doors have shut on their own. The release is frozen. All right, so it's forward, then." },
      { checkpoint: 'entrance' },
    ],
  },
  {
    id: 't_radio_first',
    when: { enter: 'reception' },
    delay: 2.4,
    actions: [
      { script: 'radio:burst' },
      { say: "The set's picking it up. The carrier is strong in here. Whatever's sending it, it's inside this building." },
    ],
  },
  {
    id: 't_phone',
    when: { discover: 'visitor_log' },
    delay: 6,
    actions: [{ set: 'phone_ringing' }, { cue: 'phone:ring' }],
  },
  {
    id: 't_read_card_hint',
    when: { enter: 'waiting' },
    delay: 1.5,
    actions: [{ say: 'Somebody left their coat behind. All the coats were left behind.' }],
  },
  {
    id: 't_admin',
    when: { enter: 'admin' },
    actions: [{ objective: 'records' }, { checkpoint: 'admin' }],
  },

  // First sighting: leaving records with the card
  {
    id: 't_first_glimpse',
    when: { enter: 'reception' },
    requires: { all: [{ item: 'security_card' }, { not: { flag: 'glimpse_gallery' } }] },
    delay: 0.6,
    repeat: true,
    actions: [
      { set: 'glimpse_gallery' },
      { script: 'listener:appear', args: { at: [3.5, 4.3, 20.3], lookAtPlayer: true, duration: 3.6 } },
      { cue: 'silence:dip' },
      { script: 'lights:flicker', args: { duration: 2.2 } },
      { say: 'Up on the gallery. There was someone... There is no one.', hold: 4 },
    ],
  },

  // Research wing
  {
    id: 't_corridor',
    when: { enter: 'labCorridor' },
    actions: [{ objective: 'power' }, { checkpoint: 'corridor' }, { say: 'Emergency lights only. I need to find out why, and where the board is.' }],
  },
  {
    id: 't_hatch_hint',
    when: { zone: [15, 3, 21, 4.7], room: 'storage' },
    requires: { door: 'd_hatch' },
    actions: [{ say: "It's a low hatch. I'll have to crouch to get through it." }],
  },
  {
    id: 't_hatch_hint_far_side',
    when: { zone: [15, 5, 21, 6.5], room: 'records' },
    requires: { door: 'd_hatch' },
    actions: [{ say: "So that's a way back through to the research wing, if I keep low." }],
  },
  {
    id: 't_electrical',
    when: { enter: 'electrical' },
    delay: 0.8,
    actions: [{ say: 'Board 2. Fuse F3 has been pulled. There should be a note, or something, knowing electricians.' }],
  },
  {
    id: 't_door_slam_corridor',
    when: { enter: 'research' },
    requires: { flag: 'hush_h1_done' },
    delay: 3.5,
    actions: [{ cue: 'distant:door' }, { script: 'lights:flicker', args: { duration: 1.2 } }],
  },
  {
    id: 't_hush1',
    when: { zone: [2, 4.7, 9, 7.7], room: 'labCorridor' },
    requires: { all: [{ flag: 'hush_h1_armed' }, { not: { flag: 'hush_h1_done' } }] },
    repeat: true,
    actions: [{ hush: 'h1' }],
  },
  {
    id: 't_h1_after',
    when: { flag: 'hush_h1_done' },
    actions: [{ say: "It's gone. Whatever that was, it walked right through. Protocol H. They wrote a protocol for it." }],
  },
  {
    id: 't_observation_figure',
    when: { enter: 'observation' },
    delay: 2.5,
    actions: [
      { script: 'listener:appear', args: { at: [1.5, 0, -6], lookAtPlayer: true, duration: 4.5 } },
      { cue: 'silence:dip' },
      { say: "There's someone standing in the chamber, past the glass.", hold: 3.4 },
    ],
  },
  {
    id: 't_lab_dead',
    when: { enter: 'restrictedLab' },
    delay: 1,
    actions: [
      { say: "I can't hear my own breathing in here. The foam swallows everything. Nothing comes back." },
      { checkpoint: 'chamber' },
    ],
  },

  // Level C
  {
    id: 't_level_c',
    when: { enter: 'liftLanding' },
    actions: [{ objective: 'archive' }, { checkpoint: 'levelC' }],
    delay: 0.5,
  },
  {
    id: 't_corridor_figure',
    when: { zone: [-2, -11.6, 9, -7.4], room: 'underCorridor' },
    delay: 1.1,
    actions: [
      {
        script: 'listener:appear',
        args: { at: [-24, -14, -9.5], lookAtPlayer: false, duration: 6.5, walkTo: [-26.2, -14, -9.5] },
      },
      { cue: 'silence:dip' },
    ],
  },
  {
    id: 't_hush2',
    when: { zone: [-20, -30, 4, -11.9], room: 'archive' },
    requires: { all: [{ flag: 'hush_h2_armed' }, { not: { flag: 'hush_h2_done' } }] },
    repeat: true,
    actions: [{ hush: 'h2' }],
  },
  {
    id: 't_h2_after',
    when: { flag: 'hush_h2_done' },
    actions: [{ say: 'She stopped right beside the rack. I could have touched her. I heard nothing at all.' }],
  },
  {
    id: 't_security_room',
    when: { enter: 'security' },
    actions: [{ checkpoint: 'security' }, { say: 'Half the monitors are running. Who kept this room alive?' }],
    delay: 0.8,
  },
  {
    id: 't_need_ignition',
    when: { discover: 'director_final' },
    requires: { not: { item: 'ignition_key' } },
    actions: [{ objective: 'ignition' }],
  },

  // The return upstairs, where the building has quietly rearranged itself
  {
    id: 't_changed_lobby',
    when: { enter: 'waiting' },
    requires: { flag: 'stairs_open' },
    repeat: true,
    actions: [{ set: 'clock_changed' }],
  },
  {
    id: 't_waiting_return',
    when: { flag: 'clock_changed' },
    delay: 1.6,
    actions: [{ say: "It's colder up here than it was. I don't remember the lobby being this quiet." }],
  },
  {
    id: 't_hush3',
    when: { zone: [-10, 8, 10, 21.7], room: 'reception' },
    requires: { all: [{ flag: 'hush_h3_armed' }, { not: { flag: 'hush_h3_done' } }] },
    repeat: true,
    actions: [{ hush: 'h3' }],
  },
  {
    id: 't_h3_after',
    when: { flag: 'hush_h3_done' },
    actions: [
      { set: 'chairs_moved' },
      { say: 'The way back is through the waiting area. Everything out here is listening now.' },
    ],
  },
  {
    id: 't_return_lower',
    when: { enter: 'security' },
    requires: { item: 'ignition_key' },
    repeat: true,
    actions: [{ objective: 'systems2' }],
  },

  // The Annex
  {
    id: 't_annex',
    when: { enter: 'annex' },
    actions: [
      { objective: 'source' },
      { checkpoint: 'annexRoom' },
      { say: 'Forty-one chairs. Forty-one headsets. Nobody in any of them.', hold: 5 },
    ],
    delay: 1.6,
  },
  {
    id: 't_annex_figure',
    when: { zone: [-46, -16, -32, -3], room: 'annex' },
    actions: [
      {
        script: 'listener:appear',
        args: { at: [-39, -14, -4.8], lookAtPlayer: true, duration: 3.4 },
      },
      { cue: 'silence:dip' },
    ],
  },
  {
    id: 't_tunnel_out',
    when: { zone: [-84, -11.5, -76, -7.5], room: 'exitTunnel' },
    actions: [{ ending: 'silence' }],
  },
];

/**
 * Fixed viewpoints used in a handful of places where composition matters more than
 * freedom. Each is short and can be turned off in settings. They all sit behind the
 * direction of travel on purpose: a camera in front would turn "forward" into "back".
 */
const cameraZones: CameraZoneDef[] = [
  { id: 'cz_entrance', room: 'mainEntrance', rect: [-4.5, 22, 4.5, 24.2], pos: [3.8, 3.5, 27.2], fov: 56, blend: 1.4 },
  { id: 'cz_hall', room: 'reception', rect: [-3.4, 16, 3.4, 21.7], pos: [-3.6, 3.3, 21.3], fov: 62, blend: 1.6 },
  { id: 'cz_junction', room: 'junction', rect: [3.3, -1.6, 9, 0.2], pos: [8.4, 2.8, 3.9], fov: 58, blend: 1.3 },
  { id: 'cz_archive', room: 'archive', rect: [-10, -30, -6, -24], pos: [-8, -9.2, -16.5], fov: 34, blend: 1.8 },
  { id: 'cz_annex_door', room: 'annex', rect: [-33, -13, -26.3, -6], pos: [-27.4, -8, -5], fov: 58, blend: 2 },
  { id: 'cz_tunnel', room: 'exitTunnel', rect: [-76, -11.5, -66, -7.5], pos: [-58, -11.4, -8.3], fov: 36, blend: 2 },
];

export const LEVEL: LevelData = {
  rooms: [...receptionRooms, ...researchRooms, ...archiveRooms],
  doors: [...receptionDoors, ...researchDoors, ...archiveDoors],
  links: [...receptionLinks, ...researchLinks, ...archiveLinks],
  triggers,
  cameraZones,
  puzzleRewards,
  start: { room: 'forecourt', pos: [0, 0, 41], yaw: 0 },
};

export const ROOM_IDS: ReadonlySet<string> = new Set(LEVEL.rooms.map((room) => room.id));
