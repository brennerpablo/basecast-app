import { THEME_SCRIPT_SOURCE } from "@/lib/theme/theme-script-source";

/**
 * Applies the theme before the first paint. It goes in the root layout's
 * `<head>` and decides from the cookie.
 *
 * A server component with no state: the HTML is identical on every request.
 *
 * The rule that must not be inverted: the class goes on `<html>` and ONLY
 * there. The `@theme` in `globals.css` is the plain one (not `@theme inline`),
 * so `--color-border: hsl(var(--border))` is emitted on `:root` and resolved at
 * the root element; a `.dark` wrapper deeper in the tree would re-resolve
 * nothing.
 */
export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT_SOURCE }} />;
}
