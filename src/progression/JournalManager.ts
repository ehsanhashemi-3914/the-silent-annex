import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { DOCUMENTS, type DocumentDef } from './content/documents';

/** Remembers which documents, tapes and terminal entries the player has found. */
export class JournalManager {
  private found: string[] = [];

  constructor(private bus: EventBus<GameEvents>) {}

  get discovered(): readonly string[] {
    return this.found;
  }

  get documents(): DocumentDef[] {
    return this.found.map((id) => DOCUMENTS[id]).filter(Boolean);
  }

  has(id: string): boolean {
    return this.found.includes(id);
  }

  discover(id: string): void {
    if (!DOCUMENTS[id] || this.has(id)) return;
    this.found.push(id);
    this.bus.emit('document:discovered', { docId: id });
  }

  restore(ids: string[]): void {
    this.found = ids.filter((id) => DOCUMENTS[id]);
  }
}
