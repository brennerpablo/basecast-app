export const HOME = "/home";

/** The landing pages: static files in `public/landing/`, served at these paths. */
export const LANDING_PAGES: Record<string, string> = {
  "/": "/landing/product.html",
  "/how-its-built": "/landing/internal.html",
};

/** Screens of the signed-in app that the public demo dropped: old links land on the home. */
const RETIRED = ["/sign-in", "/account", "/admin", "/ops"];

export type GateAction = { kind: "next" } | { kind: "rewrite"; to: string } | { kind: "redirect"; to: string };

/** What `proxy.ts` does with a request: the landing pages at their paths, the retired screens to the home. */
export function gate(pathname: string): GateAction {
  const landing = LANDING_PAGES[pathname];
  if (landing) return { kind: "rewrite", to: landing };
  if (RETIRED.some((path) => pathname === path || pathname.startsWith(`${path}/`))) return { kind: "redirect", to: HOME };
  return { kind: "next" };
}
