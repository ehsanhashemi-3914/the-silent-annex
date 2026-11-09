import type { EventBus } from '../core/EventBus';
import type { GameEvents } from '../core/GameEvents';
import { OBJECTIVES } from './content/objectives';

export class ObjectiveManager {
  currentId = 'arrive';
  completed: string[] = [];

  constructor(private bus: EventBus<GameEvents>) {}

  get text(): string {
    return OBJECTIVES[this.currentId] ?? '';
  }

  /** Moves to a new objective. Setting the current one again does nothing. */
  set(id: string): void {
    if (id === this.currentId || !(id in OBJECTIVES)) return;
    this.completed.push(this.currentId);
    this.currentId = id;
    this.bus.emit('objective:changed', { objectiveId: id, text: this.text });
  }

  restore(currentId: string, completed: string[]): void {
    this.currentId = currentId in OBJECTIVES ? currentId : 'arrive';
    this.completed = completed.filter((id) => id in OBJECTIVES);
  }
}
