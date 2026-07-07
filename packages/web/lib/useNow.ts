"use client";

import { useEffect, useState } from "react";

/** Current time in ms, or `null` until the first client tick has run.
 * Starting at `null` (rather than a lazy `useState(() => Date.now())`
 * initializer) is deliberate: that initializer runs during SSR too, at a
 * different instant than the client's hydration pass, so any output derived
 * from it (a countdown string, a state gated on "has this closed yet")
 * mismatches between the server-rendered HTML and the client's first paint
 * — React discards and re-renders the whole subtree when that happens. Null
 * is a value both passes agree on; callers that render time-derived text
 * should treat `null` as "not yet known" and show a neutral placeholder
 * until the real value arrives a moment after mount.
 *
 * The first real value is set via `setTimeout(fn, 0)` rather than calling
 * `setNow` directly in the effect body — the latter trips this repo's
 * `react-hooks/set-state-in-effect` lint rule (an effect should synchronize
 * with an external system and let *that* system's callback drive
 * `setState`, not call it straight from the effect body); a zero-delay
 * timer callback is exactly such a callback, and fires next tick rather
 * than blocking on the next `intervalMs` period the way waiting for
 * `setInterval`'s first firing would. */
export function useNow(intervalMs = 15_000): number | null {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const firstTick = setTimeout(tick, 0);
    const id = setInterval(tick, intervalMs);
    return () => {
      clearTimeout(firstTick);
      clearInterval(id);
    };
  }, [intervalMs]);

  return now;
}
