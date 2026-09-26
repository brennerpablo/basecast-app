import * as React from "react"

const MOBILE_BREAKPOINT = 768

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  mql.addEventListener("change", onChange)
  return () => mql.removeEventListener("change", onChange)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

// The server has no window and renders the desktop sidebar. Hydration reads
// this snapshot, so the first client render matches the server HTML; React
// then re-renders with the real width. Starting from the real width sent a
// phone into the Sheet branch on the first render, and the mismatch made
// React discard the hydration and rebuild the app from the root.
function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
