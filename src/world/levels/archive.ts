// Wing C: Level C, fourteen metres under the research wing. It ends in the Annex
// itself and the old service tunnel leading out to the far side of the ridge.

import type { DoorDef, LinkDef, RoomDef } from '../LevelDefinition';
import {
  bulkhead,
  COLD_DIM,
  CRT_GREEN,
  DEEP,
  deskLamp,
  doc,
  examine,
  FACE_E,
  FACE_N,
  FACE_S,
  FACE_W,
  fluoro,
  p,
  PALE,
  pendant,
  pickup,
  sign,
  spot,
  stationPair,
} from './helpers';

const LEVEL_Y = -14;
const BUNKER_AMBIENT = { sky: 0x23201a, ground: 0x0f0c08, intensity: 0.16 };
const BUNKER_FOG = { color: 0x0d0c09, density: 0.035 };

/** The Annex's 41 chairs stand in three rings around the transmitter. */
const ANNEX_CENTRE = { x: -39, z: -9.5 };
const RINGS = [
  { radius: 5.5, count: 9 },
  { radius: 8.5, count: 14 },
  { radius: 11.5, count: 18 },
];

/** Half the width of the clear walk through the rings of chairs. */
const AISLE_HALF_WIDTH = 1.25;

function chairRings() {
  const chairs = [];
  for (const ring of RINGS) {
    // The chairs share what's left of each circle after an aisle runs through it east to
    // west, from the door to the console and on toward the far door.
    const gap = Math.asin(AISLE_HALF_WIDTH / ring.radius);
    const arc = Math.PI * 2 - gap * 4;
    for (let i = 0; i < ring.count; i++) {
      let angle = gap + ((i + 0.5) / ring.count) * arc;
      if (angle > Math.PI - gap) angle += gap * 2;
      const x = ANNEX_CENTRE.x + Math.cos(angle) * ring.radius;
      const z = ANNEX_CENTRE.z + Math.sin(angle) * ring.radius;
      chairs.push(p('headsetChair', x, z, { rot: Math.atan2(ANNEX_CENTRE.x - x, ANNEX_CENTRE.z - z) }));
    }
  }
  return chairs;
}

export const archiveRooms: RoomDef[] = [
  {
    id: 'liftLanding',
    name: 'Lift Landing, Level C',
    wing: 'archive',
    rect: [9.3, -13, 16, -5.5],
    floorY: LEVEL_Y,
    height: 3.4,
    walls: { upper: 'concreteBoard', skirting: 'concreteDark' },
    floor: 'concreteSmooth',
    ceiling: 'concreteDark',
    ambient: BUNKER_AMBIENT,
    fog: BUNKER_FOG,
    surface: 'concrete',
    reverb: 'bunker',
    ambience: 'deep',
    visible: ['underCorridor'],
    lights: [bulkhead(12.5, -5.8, 2.7, { priority: 2 }), bulkhead(12.5, -12.7, 2.7, { intensity: 4, flicker: 'slow' })],
    props: [
      p('liftDoors', 15.97, -9.25, { rot: FACE_W, noCollide: true }),
      sign(15.96, 2.9, -9.25, FACE_W, 'LEVEL C', { w: 1.2, h: 0.3, color: '#111', bg: '#d0a83c' }),
      p('floorStripe', 15, -9.25, { args: { length: 3, width: 1.2, axis: 'z', color: 'hazard' }, noCollide: true }),
      p('postStation', 11.5, -12.96, { rot: FACE_S }),
      p('crate', 10.1, -6.3, { args: { w: 1, h: 0.78, d: 1 } }),
      p('recorder', 10.1, -6.3, { y: 0.78, rot: FACE_E, noCollide: true }),
      p('clock', 13, -5.54, { y: 2.6, rot: FACE_N, noCollide: true }),
    ],
    interactables: [
      {
        id: 'tr_lift_up',
        kind: 'travel',
        pos: [15.4, 1.25, -9.25],
        prompt: 'Take the lift up',
        style: 'lift',
        to: { room: 'liftLobby', pos: [14.2, 0, -9.25], yaw: Math.PI / 2 },
      },
      ...stationPair('st_archive', [11.5, 1.2, -12.5], [10.5, 1.1, -6.3]),
    ],
  },
  {
    id: 'underCorridor',
    name: 'Underground Corridor',
    wing: 'archive',
    rect: [-26, -11.6, 9, -7.4],
    floorY: LEVEL_Y,
    height: 4.2,
    walls: { upper: 'concreteBoard', lower: 'concreteDark', dado: 0.5 },
    floor: 'concreteSmooth',
    ceiling: 'concreteDark',
    ambient: BUNKER_AMBIENT,
    fog: { color: 0x0f0d09, density: 0.04 },
    surface: 'concrete',
    reverb: 'bunker',
    ambience: 'deep',
    visible: ['liftLanding', 'archive', 'security', 'annex'],
    lights: [
      bulkhead(6, -11.3, 3.1, { priority: 1 }),
      bulkhead(-3, -7.7, 3.1, { priority: 1, flicker: 'slow' }),
      bulkhead(-11, -11.3, 3.1, { priority: 1 }),
      bulkhead(-20, -7.7, 3.1, { priority: 1, flicker: 'buzz' }),
      fluoro(-24, -9.5, 4.2, { onIf: DEEP, color: PALE, intensity: 12, priority: 2 }),
    ],
    props: [
      p('cableTray', -8.5, -11.3, { y: 3.5, args: { length: 35, axis: 'x' }, noCollide: true }),
      p('pipes', -8.5, -7.65, { y: 3.65, args: { length: 35, axis: 'x', count: 3 }, noCollide: true }),
      p('floorStripe', -8.5, -9.5, { args: { length: 35, width: 0.16, axis: 'x', color: '#b38a2c' }, noCollide: true }),
      p('dialPanel', -3.8, -11.56, { y: 1.3, rot: FACE_S, noCollide: true }),
      p('poster', -1.4, -11.56, { y: 1.55, rot: FACE_S, args: { title: 'ARCHIVE CALL NUMBERS', w: 1.1, h: 1.5 }, noCollide: true }),
      p('coolantWheel', -21.5, -11.56, { y: 1.35, rot: FACE_S, noCollide: true }),
      p('pipes', -21.5, -11.4, { y: 1.35, args: { length: 3, axis: 'x', count: 1 }, noCollide: true }),
      p('wallBox', -23.6, -11.55, { y: 1.55, rot: FACE_S, noCollide: true }),
      p('serviceDoor', 2, -7.42, { rot: FACE_N, noCollide: true }),
      sign(2, 2.5, -7.43, FACE_N, 'SERVICE STAIR', { w: 1.2, h: 0.2 }),
      sign(-6, 2.9, -11.57, FACE_S, 'ARCHIVE', { w: 1.3, h: 0.28, color: '#111', bg: '#d0a83c' }),
      sign(-17, 2.7, -7.43, FACE_N, 'SECURITY CONTROL', { w: 1.6, h: 0.22, color: '#111', bg: '#d0a83c' }),
      sign(-25.96, 3.75, -9.5, FACE_E, 'ANNEX C  -  TOTAL SILENCE BEYOND THIS POINT', { w: 3.6, h: 0.26, color: '#111', bg: '#d0a83c' }),
      p('clock', 6, -7.44, { y: 2.8, rot: FACE_N, noCollide: true }),
      p('cart', -9.6, -8, { rot: 1.5 }),
      p('crate', -24.8, -8.1, { args: { w: 1.1, h: 0.9, d: 1 } }),
      p('stain', -13, -11.55, { y: 2, rot: FACE_S, args: { w: 3, h: 3.2 }, noCollide: true }),
      p('stain', 4, -7.45, { y: 2.2, rot: FACE_N, args: { w: 2.2, h: 3 }, noCollide: true }),
    ],
    interactables: [
      { id: 'pz_archive', kind: 'puzzle', puzzleId: 'archive', pos: [-3.8, 1.3, -11.1], prompt: 'Set the call number', visibleIf: { not: { solved: 'archive' } } },
      doc('rd_archive_guide', 'archive_guide', [-1.4, 1.5, -11.1], 'Read the poster', {
        actions: [{ say: 'Series, test number and time of recording. So I need to know which recording.' }],
      }),
      doc('rd_procedure_a', 'procedure_a', [-23.6, 1.5, -11.1], 'Read the clipped sheet'),
      {
        id: 'sw_coolant',
        kind: 'switch',
        pos: [-21.5, 1.35, -11.1],
        prompt: 'Open the coolant valve',
        once: true,
        actions: [{ set: 'coolant_open' }, { cue: 'valve' }, { say: 'It turns, slowly. Water knocks through the pipes and heads east.' }],
      },
      {
        id: 'sw_unbolt_stairs',
        kind: 'switch',
        pos: [2, 1.25, -7.9],
        prompt: 'Unbolt the service stair',
        once: true,
        actions: [{ set: 'stairs_open' }, { cue: 'bolt' }, { say: 'Bolted on this side. The stairs climb toward the waiting area.' }],
      },
      {
        id: 'tr_stairs_up',
        kind: 'travel',
        pos: [2, 1.25, -7.9],
        prompt: 'Climb the service stair',
        style: 'stairs',
        visibleIf: { flag: 'stairs_open' },
        to: { room: 'waiting', pos: [-20, 0, 13.2], yaw: -Math.PI / 2 },
      },
    ],
  },
  {
    id: 'archive',
    name: 'Archive Storage',
    wing: 'archive',
    rect: [-20, -30, 4, -11.9],
    floorY: LEVEL_Y,
    height: 6.5,
    walls: { upper: 'concreteBoard', skirting: 'concreteDark' },
    floor: 'concreteSmooth',
    ceiling: 'concreteDark',
    ambient: { sky: 0x1e1c17, ground: 0x0e0c08, intensity: 0.13 },
    fog: { color: 0x0b0a08, density: 0.04 },
    surface: 'concrete',
    reverb: 'bunker',
    ambience: 'deep',
    visible: ['underCorridor'],
    lights: [
      pendant(-8, -21, 4.8, { intensity: 11, distance: 13, priority: 3, flicker: 'slow' }),
      pendant(-17.5, -14, 4.8, { intensity: 7, distance: 11, priority: 2 }),
      pendant(2, -14, 4.8, { intensity: 5, distance: 10, priority: 1, flicker: 'buzz' }),
      pendant(-8, -28.2, 4, { intensity: 8, distance: 11, priority: 2 }),
    ],
    props: [
      p('tapeRack', -14, -21, { args: { length: 10 }, rot: FACE_E }),
      p('tapeRack', -11, -21, { args: { length: 10 }, rot: FACE_W }),
      p('tapeRack', -5, -21, { args: { length: 10 }, rot: FACE_E }),
      p('tapeRack', -2, -21, { args: { length: 10 }, rot: FACE_W }),
      p('desk', -8, -29.3, { rot: FACE_S, args: { w: 2.4 } }),
      p('lampDesk', -9, -29.4, { y: 0.78, rot: 0.4, noCollide: true }),
      p('papers', -7.5, -29.2, { y: 0.79, noCollide: true }),
      p('chair', -8, -28.4, { rot: FACE_N + 0.5 }),
      p('cart', -17.3, -25.5, { rot: 0.2 }),
      p('crate', 3.2, -29.2, { args: { w: 1.1, h: 0.85, d: 1.1 } }),
      p('crate', -19.2, -29.2, { args: { w: 1, h: 0.7, d: 1 } }),
      p('papers', 1.6, -20, { noCollide: true, args: { scatter: 1 } }),
      p('clock', 3.96, -14, { y: 3, rot: FACE_W, noCollide: true }),
      p('stain', -19.96, -22, { y: 3.2, rot: FACE_E, args: { w: 4, h: 5 }, noCollide: true }),
    ],
    interactables: [
      pickup('pk_reel', 'test44_reel', [-8, 0.95, -28.8], 'Take the reel', {
        actions: [
          { objective: 'security' },
          { say: 'G / 44 / 0317. It was sitting out as if someone had just collected it for me.' },
        ],
      }),
      doc('rd_procedure_b', 'procedure_b', [-7.2, 0.95, -28.8], 'Read the procedure sheet'),
      pickup('pk_security_key', 'security_key', [3.2, 1, -28.6], 'Take the key', {
        actions: [
          { checkpoint: 'securityKey' },
          { set: 'hush_h2_armed' },
          { say: 'Security control. Good. And now the room has gone...' },
        ],
      }),
      pickup('pk_battery_archive', 'battery', [-19.2, 0.82, -28.6], 'Take the battery', { pose: 'low' }),
    ],
  },
  {
    id: 'security',
    name: 'Security Control Room',
    wing: 'archive',
    rect: [-24, -7.1, -10, 2],
    floorY: LEVEL_Y,
    height: 3.2,
    walls: { upper: 'paintGrey', lower: 'metalDark', dado: 1, skirting: 'concreteDark' },
    floor: 'rubberFloor',
    ceiling: 'ceilingTile',
    ambient: { sky: 0x1a2220, ground: 0x0c0b09, intensity: 0.14 },
    fog: { color: 0x0a0d0c, density: 0.025 },
    surface: 'tile',
    reverb: 'room',
    ambience: 'lab',
    visible: ['underCorridor'],
    lights: [
      { kind: 'point', pos: [-17, 1.6, 0.4], color: CRT_GREEN, intensity: 5.5, distance: 8, fixture: 'none', priority: 4 },
      deskLamp(-11.6, 1.3, -3, { intensity: 3.2, distance: 6, priority: 2 }),
      fluoro(-17, -3.4, 3.2, { color: COLD_DIM, intensity: 3.5, alongX: true, flicker: 'buzz', priority: 1 }),
    ],
    props: [
      p('securityConsole', -17, 1.45, { rot: FACE_N }),
      p('officeChair', -17.2, -0.1, { rot: FACE_S }),
      p('generatorPanel', -10.04, -3, { rot: FACE_W, noCollide: true }),
      p('desk', -22.9, -3.4, { rot: FACE_E, args: { w: 2 } }),
      p('lampDesk', -22.8, -2.8, { y: 0.78, rot: 1.8, noCollide: true }),
      p('papers', -22.7, -3.6, { y: 0.79, noCollide: true }),
      p('mug', -23.1, -4.1, { y: 0.78, noCollide: true }),
      p('filingCabinet', -23.55, 0.9, { rot: FACE_E }),
      p('locker', -11, -6.7, { rot: FACE_S }),
      p('locker', -11.75, -6.7, { rot: FACE_S }),
      p('clock', -23.96, -5.4, { y: 2.5, rot: FACE_E, noCollide: true }),
      p('cableCoil', -12.4, 0.8, { noCollide: true }),
    ],
    interactables: [
      {
        id: 'tp_cctv',
        kind: 'tape',
        docId: 'cctv_playback',
        pos: [-15, 1.15, 0.8],
        prompt: 'Thread the reel',
        requires: { item: 'test44_reel' },
        deniedText: 'A video deck with its reel missing.',
        once: true,
        actions: [
          { take: 'test44_reel' },
          { set: 'saw_cctv' },
          { script: 'cctv:play' },
          { objective: 'systems' },
        ],
      },
      { id: 'pz_central', kind: 'puzzle', puzzleId: 'central', pos: [-10.5, 1.3, -3], prompt: 'Open the Annex systems panel' },
      doc('rd_director_final', 'director_final', [-22.2, 1, -3.4], "Read the director's note", {
        actions: [{ say: 'The generator key is upstairs, in his safe. The date of Test 44, day first.' }],
      }),
      doc('rd_procedure_c', 'procedure_c', [-22.2, 1, -2.5], 'Read the procedure sheet'),
      examine('ex_monitors', [-17, 1.6, 0.9], 'Watch the monitors', "Live feeds from the whole building. Nobody's there. And I keep checking anyway.", {
        visibleIf: { flag: 'saw_cctv', is: false },
      }),
      examine('ex_monitors2', [-17, 1.6, 0.9], 'Watch the monitors', 'She walks through every room I walked through. An hour behind me, or a year ahead.', {
        visibleIf: { flag: 'saw_cctv' },
      }),
    ],
  },
  {
    id: 'annex',
    name: 'The Annex',
    wing: 'archive',
    rect: [-52, -26, -26.3, 7],
    floorY: LEVEL_Y,
    height: 14,
    walls: { upper: 'foam', skirting: 'metalDark' },
    floor: 'concreteDark',
    ceiling: 'foam',
    ambient: { sky: 0x2a3036, ground: 0x0c0c0e, intensity: 0.34 },
    fog: { color: 0x07090b, density: 0.012 },
    surface: 'grate',
    reverb: 'dead',
    ambience: 'annex',
    visible: ['underCorridor', 'exitTunnel'],
    lights: [
      spot([-39, 13, -9.5], [-39, 0, -9.5], { color: 0xdbe6e2, intensity: 640, distance: 24, angle: 0.62, penumbra: 0.9, shadow: true, priority: 5 }),
      { kind: 'point', pos: [-39, 1.6, -9.5], color: 0xffb46a, intensity: 5, distance: 9, fixture: 'none', priority: 4 },
      { kind: 'point', pos: [-29, 1.8, -9.5], color: PALE, intensity: 5, distance: 12, fixture: 'none', priority: 2 },
      { kind: 'point', pos: [-39, 7, -9.5], color: 0x7fa0c8, intensity: 18, distance: 26, fixture: 'none', onIf: DEEP, priority: 1 },
      { kind: 'point', pos: [-51, 2.6, -9.5], color: 0xe9c79a, intensity: 3, distance: 7, fixture: 'none', onIf: { flag: 'signal_cut' }, priority: 3 },
    ],
    props: [
      p('foamWalls', 0, 0, { noCollide: true }),
      p('wireFloor', -39, -9.5, { noCollide: true, args: { large: true } }),
      p('tapeArray', -39, -9.5, { noCollide: true }),
      p('transmitter', -39, -9.5),
      p('micStand', -38.1, -8.4, { rot: 2.4, noCollide: true }),
      ...chairRings(),
    ],
    interactables: [
      {
        id: 'tp_hana_final',
        kind: 'tape',
        docId: 'hana_final',
        pos: [-39.4, 1.2, -8.2],
        prompt: 'Play the last tape',
        once: true,
        actions: [{ set: 'heard_final' }],
      },
      {
        id: 'sw_cut',
        kind: 'switch',
        pos: [-40.5, 1.1, -9.1],
        prompt: 'Cut the transmitter',
        visibleIf: { all: [{ flag: 'heard_final' }, { not: { flag: 'signal_cut' } }] },
        once: true,
        actions: [
          { set: 'signal_cut' },
          { cue: 'signal:cut' },
          { script: 'signal:cut' },
          { objective: 'leave' },
          { say: "It stops. For the first time in fourteen months, it stops. There's a door in the west wall." },
        ],
      },
      {
        id: 'sw_speak',
        kind: 'switch',
        pos: [-38.1, 1.35, -8.4],
        prompt: 'Speak into the microphone',
        visibleIf: { all: [{ flag: 'heard_final' }, { not: { flag: 'signal_cut' } }] },
        once: true,
        actions: [{ ending: 'answer' }],
      },
    ],
  },
  {
    id: 'exitTunnel',
    name: 'Service Tunnel',
    wing: 'archive',
    rect: [-84, -11.5, -52.3, -7.5],
    floorY: LEVEL_Y,
    height: 4.5,
    walls: { upper: 'rock' },
    floor: 'concreteDark',
    ceiling: 'rock',
    ambient: { sky: 0x4a4a55, ground: 0x12100e, intensity: 0.25 },
    fog: { color: 0x3a3238, density: 0.03 },
    surface: 'concrete',
    reverb: 'bunker',
    ambience: 'dawn',
    visible: ['annex'],
    lights: [
      { kind: 'point', pos: [-81, 2.8, -9.5], color: 0xffc090, intensity: 40, distance: 24, fixture: 'none', priority: 5 },
      { kind: 'point', pos: [-66, 2.5, -9.5], color: 0xc07a50, intensity: 5, distance: 12, fixture: 'none', priority: 2 },
    ],
    props: [
      p('dawnOpening', -83.9, -9.5, { rot: FACE_E, noCollide: true }),
      p('pipes', -68, -7.8, { y: 3.8, args: { length: 31, axis: 'x', count: 2 }, noCollide: true }),
      p('snowDrift', -82.3, -9.2, { scale: 1.2, noCollide: true }),
      p('snowDrift', -80.6, -10.4, { scale: 0.7, noCollide: true }),
    ],
    interactables: [],
  },
];

export const archiveDoors: DoorDef[] = [
  {
    id: 'd_archive',
    name: 'Archive Door',
    a: 'underCorridor',
    b: 'archive',
    side: 'n',
    at: -6,
    width: 1.8,
    height: 2.5,
    style: 'slide',
    lock: { type: 'keypad', puzzleId: 'archive', text: "It won't open by hand. There's a dial panel beside it." },
  },
  {
    id: 'd_security',
    name: 'Security Control Door',
    a: 'underCorridor',
    b: 'security',
    side: 's',
    at: -17,
    width: 1.2,
    style: 'steel',
    lock: { type: 'key', itemId: 'security_key', consume: true, text: 'Locked. "Security Control. Key from Archive Desk."' },
  },
  {
    id: 'd_annex',
    name: 'Annex Door',
    a: 'underCorridor',
    b: 'annex',
    side: 'w',
    at: -9.5,
    width: 3,
    height: 3.2,
    style: 'blast',
    lock: { type: 'flag', flag: 'annex_release', text: 'The door weighs tons, and the interlock is holding it. It can only be released from security control.' },
  },
  {
    id: 'd_exit',
    name: 'Service Tunnel Door',
    a: 'annex',
    b: 'exitTunnel',
    side: 'w',
    at: -9.5,
    width: 1.5,
    style: 'steel',
    lock: { type: 'flag', flag: 'signal_cut', text: "An interlock light glows red above it. While the transmitter's running, it stays shut." },
  },
];

export const archiveLinks: LinkDef[] = [
  { a: 'liftLanding', b: 'underCorridor', side: 'w', at: -9.5, width: 3.4, kind: 'arch', top: 2.9 },
];
