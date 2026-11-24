'use client';
import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { loader, onLoader } from '@/lib/loader';

/** Ends a pending navigation once the URL has actually changed. */
function RouteWatcher({ navigating }: { navigating: React.MutableRefObject<boolean> }) {
  const path = usePathname();
  const search = useSearchParams();
  useEffect(() => {
    if (navigating.current) { navigating.current = false; loader.done(); }
  }, [path, search, navigating]);
  return null;
}

/**
 * Slim progress bar fixed to the top of the viewport. It shows whenever any
 * `api()` request is in flight or a link navigation is pending.
 */
export function TopLoader() {
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const navigating = useRef(false);

  // Start the loader on internal link clicks.
  useEffect(() => {
    let safety: ReturnType<typeof setTimeout> | undefined;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as HTMLElement | null)?.closest?.('a');
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin) return;
      if (url.pathname === location.pathname && url.search === location.search) return;
      if (!navigating.current) { navigating.current = true; loader.start(); }
      clearTimeout(safety);
      safety = setTimeout(() => { if (navigating.current) { navigating.current = false; loader.done(); } }, 10000);
    };
    document.addEventListener('click', onClick, true);
    return () => { document.removeEventListener('click', onClick, true); clearTimeout(safety); };
  }, []);

  // Drive the bar from the global busy state.
  useEffect(() => {
    let showT: ReturnType<typeof setTimeout> | undefined;
    let trickle: ReturnType<typeof setInterval> | undefined;
    let hideT: ReturnType<typeof setTimeout> | undefined;
    const unsub = onLoader((busy) => {
      clearTimeout(showT); clearTimeout(hideT); clearInterval(trickle);
      if (busy) {
        // small delay so very fast requests don't flash the bar
        showT = setTimeout(() => {
          setVisible(true); setProgress(8);
          trickle = setInterval(() => setProgress((p) => (p < 90 ? p + (90 - p) * 0.08 : p)), 200);
        }, 120);
      } else {
        setProgress((p) => (p > 0 ? 100 : 0));
        hideT = setTimeout(() => { setVisible(false); setProgress(0); }, 300);
      }
    });
    return () => { unsub(); clearTimeout(showT); clearTimeout(hideT); clearInterval(trickle); };
  }, []);

  return (
    <>
      <Suspense fallback={null}><RouteWatcher navigating={navigating} /></Suspense>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[3px]" style={{ opacity: visible ? 1 : 0, transition: 'opacity .3s ease' }}>
        <div className="h-full" style={{
          width: `${progress}%`,
          background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
          boxShadow: '0 0 10px var(--accent), 0 0 4px var(--accent)',
          transition: progress === 0 ? 'none' : 'width .25s ease',
        }} />
      </div>
      {visible && <span className="sr-only" role="status">Loading…</span>}
    </>
  );
}
