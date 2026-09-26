import { DARK_THEMES, DEFAULT_THEME, THEME_COOKIE, THEMES } from "./theme-cookie";

/** `t!=="light"&&t!=="zinc"&&t!=="deep"`, derived so the list lives in one place. */
const REJECT_UNKNOWN = THEMES.map((t) => `t!=="${t}"`).join("&&");
/** `t==="zinc"||t==="deep"` */
const IS_DARK = DARK_THEMES.map((t) => `t==="${t}"`).join("||");

/**
 * The script that decides the theme before the first paint.
 *
 * It runs in `<head>`, before `<body>` is even parsed. This is the pattern the
 * Next docs describe in "preventing flash before hydration". `next/script` with
 * `beforeInteractive` does NOT work for an inline script: it only runs at the
 * Next bootstrap, long after the paint.
 *
 * **It does not read `prefers-color-scheme`.** Without a cookie the app is
 * light, even for a system in dark mode.
 *
 * It only touches the class and the palette attribute. No `style.colorScheme`:
 * an inline style would beat the `:root { color-scheme: only light }` in
 * `globals.css`. The `.dark` rule in CSS switches `color-scheme` instead.
 *
 * The string is CONSTANT, with no runtime data interpolated, so it fits a
 * `'sha256-…'` if a CSP is ever added.
 */
export const THEME_SCRIPT_SOURCE = [
  "(function(){try{",
  `var m=document.cookie.match(new RegExp("(?:^|; )${THEME_COOKIE}=([^;]*)"));`,
  `var t=m?m[1]:"${DEFAULT_THEME}";`,
  `if(${REJECT_UNKNOWN})t="${DEFAULT_THEME}";`,
  `if(!(${IS_DARK}))return;`,
  "var e=document.documentElement;",
  'e.classList.add("dark");',
  'if(t!=="zinc")e.setAttribute("data-dark-palette",t);',
  "}catch(e){}})()",
].join("");
