"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "@/lib/format";

/**
 * Ticking elapsed-time display for a live workout.
 *
 * `startedAtMs` is passed as a number rather than a Date so the server and
 * first client render agree — and the initial state is computed from it
 * rather than from Date.now(), so there is no hydration mismatch on the very
 * first paint.
 */
export function WorkoutTimer({ startedAtMs }: { startedAtMs: number }) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, [startedAtMs]);

  return (
    <span className="tnum text-sm text-muted-foreground" aria-label="Elapsed time">
      {formatDuration(elapsed)}
    </span>
  );
}
