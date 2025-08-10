import { useEffect, useRef } from 'react';

// Simple idle session manager
// onIdle: callback when user is idle beyond idleMs
// onWarn: optional callback when warning threshold is reached
// warnMs: interval before idleMs to trigger warn (e.g., 60_000)
export default function useIdleSession({ idleMs = 15 * 60 * 1000, warnMs = 60 * 1000, onIdle, onWarn }) {
  const lastActivityRef = useRef(Date.now());
  const warnedRef = useRef(false);

  useEffect(() => {
    const resetActivity = () => {
      lastActivityRef.current = Date.now();
      warnedRef.current = false;
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, resetActivity, { passive: true }));

    const tick = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivityRef.current;
      if (!warnedRef.current && onWarn && elapsed >= idleMs - warnMs && elapsed < idleMs) {
        warnedRef.current = true;
        try { onWarn({ remainingMs: Math.max(0, idleMs - elapsed) }); } catch {}
      }
      if (elapsed >= idleMs) {
        try { onIdle && onIdle(); } catch {}
      }
    }, 1000);

    return () => {
      events.forEach(evt => window.removeEventListener(evt, resetActivity));
      clearInterval(tick);
    };
  }, [idleMs, warnMs, onIdle, onWarn]);
}
