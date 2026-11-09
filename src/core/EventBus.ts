// A typed publish/subscribe channel. Systems announce what happened without
// knowing who is listening, which keeps gameplay logic independent of audio and UI.

type Listener<T> = (payload: T) => void;

export class EventBus<Events extends object> {
  private listeners = new Map<keyof Events, Set<Listener<never>>>();

  /** Subscribes to an event. The returned function unsubscribes again. */
  on<K extends keyof Events>(type: K, fn: Listener<Events[K]>): () => void {
    let set = this.listeners.get(type);
    if (!set) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn as Listener<never>);
    return () => set.delete(fn as Listener<never>);
  }

  emit<K extends keyof Events>(type: K, payload: Events[K]): void {
    const set = this.listeners.get(type);
    if (!set) return;
    // Copy first, because a listener is allowed to unsubscribe while being called.
    for (const fn of [...set]) (fn as Listener<Events[K]>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
