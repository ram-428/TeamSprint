'use client';
/** Global busy counter that drives the top loading bar (API requests + route navigation). */
let active = 0;
const subs = new Set<(busy: boolean) => void>();
const emit = () => subs.forEach((f) => f(active > 0));

export const loader = {
  start() { active++; if (active === 1) emit(); },
  done() { if (active === 0) return; active--; if (active === 0) emit(); },
  reset() { if (active === 0) return; active = 0; emit(); },
  /** Wrap a promise so the bar shows while it is pending. */
  track<T>(p: Promise<T>): Promise<T> { loader.start(); return p.finally(() => loader.done()); },
};

export function onLoader(f: (busy: boolean) => void) { subs.add(f); f(active > 0); return () => { subs.delete(f); }; }
