/**
 * `callbackUrl` comes from the query string, so it is attacker input: an absolute value
 * (`https://evil.com`) would send the freshly signed-in user out of the app. Only an internal path
 * passes; protocol-relative (`//host`) and the backslash trick (`/\host`) are rejected along with
 * any absolute URL.
 */
export function safeInternalPath(value: string | null | undefined): string {
  return value && /^\/(?![/\\])/.test(value) ? value : "/";
}
