type Handler<T> = (payload: T) => void;

/** Küçük, tipli olay yayıcı. */
export class Emitter<Events extends Record<string, unknown>> {
  private handlers: { [K in keyof Events]?: Handler<Events[K]>[] } = {};

  on<K extends keyof Events>(event: K, handler: Handler<Events[K]>): () => void {
    (this.handlers[event] ??= []).push(handler);
    return () => this.off(event, handler);
  }

  off<K extends keyof Events>(event: K, handler: Handler<Events[K]>): void {
    const list = this.handlers[event];
    if (!list) return;
    const i = list.indexOf(handler);
    if (i >= 0) list.splice(i, 1);
  }

  emit<K extends keyof Events>(event: K, payload: Events[K]): void {
    const list = this.handlers[event];
    if (!list) return;
    for (const h of [...list]) h(payload);
  }
}
