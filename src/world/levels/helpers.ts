import type { Condition, Vec3 } from '../../core/Script';
import type { InteractableDef, LightDef, PropArgs, PropDef, PropType } from '../LevelDefinition';

// Rotations for wall-mounted props, named after the direction the prop faces.
export const FACE_S = 0;
export const FACE_N = Math.PI;
export const FACE_E = Math.PI / 2;
export const FACE_W = -Math.PI / 2;

// The Alpine Brutalist light palette.
export const COLD = 0xbcdcd2;
export const COLD_DIM = 0x8fb4ac;
export const SODIUM = 0xffa44f;
export const WARM = 0xffc98a;
export const EMERGENCY = 0xff3320;
export const MOON = 0x8fb2d8;
export const CRT_GREEN = 0x62f0a0;
export const PALE = 0xdfe6dc;

export const POWER: Condition = { flag: 'main_power' };
export const NO_POWER: Condition = { not: POWER };
export const DEEP: Condition = { flag: 'deep_power' };
export const NO_DEEP: Condition = { not: DEEP };

type LightOptions = Partial<LightDef>;

export function fluoro(x: number, z: number, h: number, options: LightOptions = {}): LightDef {
  return {
    kind: 'point',
    pos: [x, h - 0.3, z],
    color: COLD,
    intensity: 11,
    distance: 11,
    fixture: 'fluoro',
    ...options,
  };
}

export function emergency(x: number, z: number, h: number, options: LightOptions = {}): LightDef {
  return {
    kind: 'point',
    pos: [x, h - 0.25, z],
    color: EMERGENCY,
    intensity: 6,
    distance: 9,
    fixture: 'emergency',
    flicker: 'pulse',
    ...options,
  };
}

export function bulkhead(x: number, z: number, y: number, options: LightOptions = {}): LightDef {
  return {
    kind: 'point',
    pos: [x, y, z],
    color: SODIUM,
    intensity: 7,
    distance: 10,
    fixture: 'bulkhead',
    ...options,
  };
}

export function pendant(x: number, z: number, y: number, options: LightOptions = {}): LightDef {
  return {
    kind: 'point',
    pos: [x, y, z],
    color: SODIUM,
    intensity: 16,
    distance: 15,
    fixture: 'pendant',
    ...options,
  };
}

export function deskLamp(x: number, y: number, z: number, options: LightOptions = {}): LightDef {
  return {
    kind: 'point',
    pos: [x, y, z],
    color: WARM,
    intensity: 2.6,
    distance: 5,
    fixture: 'none',
    ...options,
  };
}

/** A soft directional pool of light, usually moonlight through a window. */
export function spot(pos: Vec3, target: Vec3, options: LightOptions = {}): LightDef {
  return {
    kind: 'spot',
    pos,
    target,
    color: MOON,
    intensity: 60,
    distance: 30,
    angle: 0.6,
    penumbra: 0.8,
    fixture: 'none',
    ...options,
  };
}

/** Shorthand for placing a prop: p('chair', x, z, { rot, args... }). */
export function p(
  type: PropType,
  x: number,
  z: number,
  options: Omit<PropDef, 'type' | 'x' | 'z'> = {},
): PropDef {
  return { type, x, z, ...options };
}

export function sign(x: number, y: number, z: number, rot: number, text: string, args: PropArgs = {}): PropDef {
  return { type: 'sign', x, z, y, rot, args: { text, ...args }, noCollide: true };
}

type InteractableInput = Omit<InteractableDef, 'id' | 'pos' | 'prompt' | 'kind'>;

/** A readable document. */
export function doc(id: string, docId: string, pos: Vec3, prompt = 'Read', extra: InteractableInput = {}): InteractableDef {
  return { id, kind: 'document', docId, pos, prompt, ...extra } as InteractableDef;
}

/** A carried-away item. */
export function pickup(
  id: string,
  itemId: string,
  pos: Vec3,
  prompt: string,
  extra: InteractableInput & { hideModel?: boolean } = {},
): InteractableDef {
  return { id, kind: 'pickup', itemId, pos, prompt, ...extra } as InteractableDef;
}

/** Looking closely at something, which produces one of Ilse's short remarks. */
export function examine(id: string, pos: Vec3, prompt: string, text: string, extra: InteractableInput = {}): InteractableDef {
  return { id, kind: 'examine', text, pos, prompt, ...extra } as InteractableDef;
}

export function stationPair(prefix: string, post: Vec3, recorder: Vec3): InteractableDef[] {
  return [
    { id: `${prefix}_post`, kind: 'post', pos: post, prompt: 'Use pneumatic post' },
    { id: `${prefix}_recorder`, kind: 'recorder', pos: recorder, prompt: 'Record a log (save)' },
  ];
}
