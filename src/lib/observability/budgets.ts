/**
 * A BFF request slower than this is logged as `warn`, and a p95 above it marks a service degraded on
 * /ops: the budget a screen can afford per call. Shared by the server logger and the /ops screen.
 */
export const SLOW_REQUEST_MS = 1_500;
