// The small data language used by level files. A Condition asks a question about
// the game state and an Action changes it. Keeping both as plain data means the
// whole story can be played and tested without a renderer.

export type Vec3 = [number, number, number];

export type PuzzleId = 'records_keypad' | 'electrical' | 'archive' | 'central' | 'director_safe';

export type EndingId = 'silence' | 'answer';

export type HushId = 'h1' | 'h2' | 'h3';

export type Condition =
  | { flag: string; is?: boolean }
  | { item: string }
  | { door: string }
  | { solved: PuzzleId }
  | { visited: string }
  | { read: string }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition };

export type ScriptArgs = Record<string, string | number | boolean | Vec3 | Vec3[]>;

export type Action =
  | { set: string; value?: boolean }
  | { give: string }
  | { take: string }
  | { unlock: string }
  | { open: string }
  | { close: string }
  | { objective: string }
  | { say: string; hold?: number }
  | { toast: string }
  | { discover: string }
  | { cue: string; at?: Vec3 }
  | { script: string; args?: ScriptArgs }
  | { hush: HushId }
  | { checkpoint: string }
  | { ending: EndingId };
