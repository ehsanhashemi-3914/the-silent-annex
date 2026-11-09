import type { EndingId, HushId, PuzzleId, ScriptArgs, Vec3 } from './Script';
import type { HushPhase } from '../systems/HushSequence';

/** Every message that can travel over the game's EventBus. */
export interface GameEvents {
  'flag:changed': { flag: string; value: boolean };
  'room:entered': { roomId: string; previous: string | null; firstVisit: boolean };
  'item:added': { itemId: string };
  'item:removed': { itemId: string };
  'item:used': { itemId: string };
  'inventory:full': { itemId: string };
  'interactable:used': { id: string };
  'door:unlocked': { doorId: string };
  'door:opened': { doorId: string };
  'door:closed': { doorId: string };
  'door:denied': { doorId: string; text: string };
  'puzzle:changed': { puzzleId: PuzzleId };
  'puzzle:solved': { puzzleId: PuzzleId };
  'puzzle:failed': { puzzleId: PuzzleId; reason: string };
  'objective:changed': { objectiveId: string; text: string };
  'document:discovered': { docId: string };
  say: { text: string; hold: number };
  toast: { text: string };
  cue: { cue: string; at?: Vec3 };
  script: { name: string; args: ScriptArgs };
  checkpoint: { id: string };
  ending: { ending: EndingId };
  'hush:phase': { id: HushId; phase: HushPhase; previous: HushPhase };
  'hush:ended': { id: HushId; outcome: 'survived' | 'caught' };
}
