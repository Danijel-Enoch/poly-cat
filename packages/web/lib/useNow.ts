"use client";

import { useEffect, useState } from "react";

/** Current time in ms. The lazy `useState` initializer is the one React-sanctioned
 * place to read impure values during render (evaluated once, not on every render);
 * the effect only subscribes to the interval, never calling `setState` synchronously
 * in the effect body itself, per `react-hooks/set-state-in-effect`. */
export function useNow(intervalMs = 15_000): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return now;
}
