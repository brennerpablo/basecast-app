"use client";

import { createContext, type ReactNode, useContext, useState } from "react";

const RecordedAtContext = createContext<string | null>(null);

/** Hands the snapshot's recording time (ISO) to the screens that measure freshness. */
export function SnapshotClock({ recordedAt, children }: { recordedAt: string; children: ReactNode }) {
  return <RecordedAtContext.Provider value={recordedAt}>{children}</RecordedAtContext.Provider>;
}

/**
 * "Now" for anything that asks how fresh the data is: the moment the snapshot was recorded, so a source on a
 * schedule reads as it did then instead of drifting overdue while nothing runs.
 */
export function useSnapshotNow(): number {
  const recordedAt = useContext(RecordedAtContext);
  // Outside the app shell (tests) there is no snapshot: the moment the screen mounted.
  const [mounted] = useState(() => Date.now());
  return recordedAt ? Date.parse(recordedAt) : mounted;
}
