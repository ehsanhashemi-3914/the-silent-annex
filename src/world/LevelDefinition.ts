// The shape of level data. Everything here is plain data with no Three.js types,
// so the same definitions drive the renderer, the physics and the logic tests.

import type { Action, Condition, PuzzleId, Vec3 } from '../core/Script';

export type Side = 'n' | 's' | 'e' | 'w';
export type Wing = 'exterior' | 'reception' | 'research' | 'archive';
export type SurfaceId = 'concrete' | 'tile' | 'metal' | 'carpet' | 'snow' | 'foam' | 'grate';
export type ReverbId = 'outside' | 'hall' | 'room' | 'corridor' | 'dead' | 'bunker' | 'cathedral';
export type AmbienceId = 'wind' | 'lobby' | 'hum' | 'lab' | 'deep' | 'annex' | 'dawn';

export type MaterialId =
  | 'concreteBoard'
  | 'concreteSmooth'
  | 'concreteDark'
  | 'plasterPale'
  | 'paintSeafoam'
  | 'paintOchre'
  | 'paintGrey'
  | 'terrazzo'
  | 'lino'
  | 'carpet'
  | 'rubberFloor'
  | 'grating'
  | 'ceilingTile'
  | 'snow'
  | 'rock'
  | 'wood'
  | 'woodDark'
  | 'metalPainted'
  | 'metalGreen'
  | 'metalDark'
  | 'metalBrushed'
  | 'rust'
  | 'brass'
  | 'steelBlue'
  | 'plastic'
  | 'plasticBeige'
  | 'rubber'
  | 'foam'
  | 'fabric'
  | 'fabricGreen'
  | 'leather'
  | 'paper'
  | 'cardboard'
  | 'glass'
  | 'glassFrosted'
  | 'glassDark'
  | 'hazard'
  | 'redPaint'
  | 'plant';

/** Every kind of prop the world can place. The catalogue must implement all of them. */
export type PropType =
  // Structure
  | 'column'
  | 'beam'
  | 'block'
  | 'duct'
  | 'pipes'
  | 'cableTray'
  | 'facade'
  | 'canopy'
  | 'rockWall'
  | 'monolith'
  | 'bollard'
  | 'snowDrift'
  | 'gallery'
  | 'radiator'
  | 'vent'
  | 'fireExt'
  | 'wallBox'
  | 'sign'
  | 'poster'
  | 'noticeboard'
  | 'clock'
  | 'mural'
  | 'plaque'
  | 'window'
  | 'stain'
  | 'floorStripe'
  | 'lightShaft'
  | 'cctvCam'
  | 'serviceDoor'
  // Furniture
  | 'receptionDesk'
  | 'bench'
  | 'chair'
  | 'officeChair'
  | 'lowTable'
  | 'coatRack'
  | 'labCoat'
  | 'plant'
  | 'vending'
  | 'desk'
  | 'bookshelf'
  | 'filingCabinet'
  | 'filingRow'
  | 'rug'
  | 'labBench'
  | 'stool'
  | 'whiteboard'
  | 'shelf'
  | 'locker'
  | 'crate'
  | 'cart'
  | 'wallSafe'
  | 'phone'
  | 'papers'
  | 'magazines'
  | 'mug'
  | 'lampDesk'
  // Equipment
  | 'crt'
  | 'reelDeck'
  | 'breakerPanel'
  | 'scopeRack'
  | 'transformer'
  | 'tapeRack'
  | 'micStand'
  | 'testChair'
  | 'foamWalls'
  | 'wireFloor'
  | 'coolantWheel'
  | 'securityConsole'
  | 'generatorPanel'
  | 'postStation'
  | 'recorder'
  | 'cardReader'
  | 'keypad'
  | 'dialPanel'
  | 'tapeArray'
  | 'transmitter'
  | 'liftDoors'
  | 'toolbox'
  | 'cableCoil'
  | 'headsetChair'
  | 'dawnOpening'
  | 'observationConsole';

export type PropArgs = Record<string, string | number | boolean>;

export interface PropDef {
  type: PropType;
  x: number;
  z: number;
  /** Height above the room floor. */
  y?: number;
  /** Rotation about the vertical axis. A rotation of 0 faces south (+z). */
  rot?: number;
  scale?: number;
  args?: PropArgs;
  /** Only shown while this condition holds. Such props stay separate from the merged room mesh. */
  visibleIf?: Condition;
  noCollide?: boolean;
}

export type FixtureKind = 'fluoro' | 'bulkhead' | 'pendant' | 'emergency' | 'caged' | 'desk' | 'none';
export type FlickerKind = 'none' | 'slow' | 'broken' | 'buzz' | 'pulse';

export interface LightDef {
  kind: 'point' | 'spot';
  /** World-space height is relative to the room floor. */
  pos: Vec3;
  color: number;
  intensity: number;
  distance: number;
  fixture?: FixtureKind;
  /** Turns a fluorescent fixture along the x-axis instead of the z-axis. */
  alongX?: boolean;
  onIf?: Condition;
  flicker?: FlickerKind;
  target?: Vec3;
  angle?: number;
  penumbra?: number;
  shadow?: boolean;
  priority?: number;
}

export type InteractableDef = {
  id: string;
  pos: Vec3;
  prompt: string;
  range?: number;
  /** Hidden and unusable until this holds. */
  visibleIf?: Condition;
  /** Visible, but the player is refused with deniedText until this holds. */
  requires?: Condition;
  deniedText?: string;
  actions?: Action[];
  /** Disappears after a single use. Pickups always behave this way. */
  once?: boolean;
  pose?: 'reach' | 'low' | 'high';
} & (
  | { kind: 'pickup'; itemId: string; hideModel?: boolean }
  | { kind: 'document'; docId: string }
  | { kind: 'terminal'; docId: string }
  | { kind: 'tape'; docId: string }
  | { kind: 'puzzle'; puzzleId: PuzzleId }
  | { kind: 'post' }
  | { kind: 'recorder' }
  | { kind: 'examine'; text: string }
  | { kind: 'switch' }
  | { kind: 'travel'; to: { room: string; pos: Vec3; yaw: number }; style: 'lift' | 'stairs' }
);

export interface RoomDef {
  id: string;
  name: string;
  wing: Wing;
  /** Interior footprint as [minX, minZ, maxX, maxZ]. */
  rect: [number, number, number, number];
  floorY: number;
  height: number;
  walls: { upper: MaterialId; lower?: MaterialId; dado?: number; skirting?: MaterialId };
  floor: MaterialId;
  ceiling: MaterialId | null;
  /** Exterior rooms get invisible boundaries in place of real walls. */
  openAir?: boolean;
  ambient: { sky: number; ground: number; intensity: number };
  fog: { color: number; density: number };
  surface: SurfaceId;
  reverb: ReverbId;
  ambience: AmbienceId;
  /** Rooms that can be seen from here and so must stay rendered. */
  visible: string[];
  lights: LightDef[];
  props: PropDef[];
  interactables: InteractableDef[];
}

export type DoorStyle = 'wood' | 'steel' | 'double' | 'slide' | 'blast' | 'hatch';

export type DoorLock =
  | { type: 'none' }
  /** Needs an item. A consumed key is removed from the bag when it unlocks the door. */
  | { type: 'key'; itemId: string; consume: boolean; text: string }
  | { type: 'keypad'; puzzleId: PuzzleId; text: string }
  | { type: 'flag'; flag: string; text: string }
  /** Bolted on one side: it can only be opened from the given room. */
  | { type: 'oneway'; from: string; text: string };

export interface DoorDef {
  id: string;
  name: string;
  /** Room A owns the door, on the given side of its wall. Room B is on the opposite side. */
  a: string;
  b: string;
  side: Side;
  /** World coordinate along the wall: x for north/south walls, z for east/west walls. */
  at: number;
  width: number;
  height?: number;
  style: DoorStyle;
  lock: DoorLock;
  /** When this holds, the door cannot be opened again, whatever its lock says. */
  sealedIf?: Condition;
  sealedText?: string;
  label?: string;
}

/** A doorless connection between two rooms, or a window between them. */
export interface LinkDef {
  a: string;
  b: string;
  side: Side;
  at: number;
  width: number;
  kind: 'arch' | 'window';
  sill?: number;
  top?: number;
}

export type TriggerWhen =
  | { enter: string }
  | { flag: string }
  | { item: string }
  | { solved: PuzzleId }
  | { discover: string }
  | { used: string }
  | { zone: [number, number, number, number]; room: string };

export interface TriggerDef {
  id: string;
  when: TriggerWhen;
  requires?: Condition;
  actions: Action[];
  /** Seconds to wait after firing before the actions run. */
  delay?: number;
  /** Repeatable triggers fire every time they match, while requires holds. */
  repeat?: boolean;
}

/** A region in which the camera leaves the shoulder for a composed viewpoint. */
export interface CameraZoneDef {
  id: string;
  room: string;
  rect: [number, number, number, number];
  pos: Vec3;
  fov?: number;
  blend?: number;
}

export interface LevelData {
  rooms: RoomDef[];
  doors: DoorDef[];
  links: LinkDef[];
  triggers: TriggerDef[];
  cameraZones: CameraZoneDef[];
  puzzleRewards: Record<PuzzleId, Action[]>;
  start: { room: string; pos: Vec3; yaw: number };
}
