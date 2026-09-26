/**
 * Theme preference: cookie name, vocabulary and PURE readers.
 *
 * Pure on purpose: the reader takes the cookie string instead of fetching it,
 * so the same code serves `document.cookie` in the browser, a `Cookie` header
 * on the server and a literal string in a test.
 *
 * A cookie and not `localStorage` because the preference has to be known
 * BEFORE the first paint, and the inline script that applies it runs in
 * `<head>`.
 */

export const THEME_COOKIE = "basecast-theme";

/** One year: it is a preference, not a session. */
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * One value that is both light/dark AND the dark style.
 *
 * **There is no `system`.** The OS preference is ignored on purpose: whoever
 * has not picked a theme sees the product in light, even on a device in dark
 * mode. Dark is an explicit choice.
 */
export const THEMES = ["light", "zinc", "deep"] as const;
export type Theme = (typeof THEMES)[number];

/** What the class on `<html>` ends up being. */
export type ResolvedTheme = "light" | "dark";

export const DEFAULT_THEME: Theme = "light";

/** The dark themes. `zinc` is the base `.dark`; `deep` adds the attribute. */
export const DARK_THEMES: readonly Theme[] = ["zinc", "deep"];

export function isDarkTheme(theme: Theme): boolean {
  return DARK_THEMES.includes(theme);
}

export function resolvedThemeOf(theme: Theme): ResolvedTheme {
  return isDarkTheme(theme) ? "dark" : "light";
}

export function parseTheme(raw: string | null | undefined): Theme {
  return THEMES.includes(raw as Theme) ? (raw as Theme) : DEFAULT_THEME;
}

/** Reads a cookie from a string shaped like `a=1; b=2`. */
export function readCookie(cookieString: string, name: string): string | null {
  for (const part of cookieString.split(";")) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return part.slice(eq + 1).trim();
  }
  return null;
}

export function readThemeCookie(cookieString: string): Theme {
  return parseTheme(readCookie(cookieString, THEME_COOKIE));
}

/** A value ready for `document.cookie = …`. */
export function serializeCookie(name: string, value: string): string {
  return `${name}=${value}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
}
