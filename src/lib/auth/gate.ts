export const HOME = "/insights";
export const SIGN_IN = "/sign-in";

/** The landing pages: static files in `public/landing/`, served at these paths. */
export const LANDING_PAGES: Record<string, string> = {
  "/": "/landing/product.html",
  "/how-its-built": "/landing/internal.html",
};

export type GateAction =
  | { kind: "next" }
  | { kind: "rewrite"; to: string }
  | { kind: "redirect"; to: string }
  | { kind: "unauthorized" };

/**
 * What `proxy.ts` does with a request. `/` is the product landing page for visitors and the app for
 * users; `/how-its-built` is open to everyone. The rest needs a session: pages go to /sign-in (keeping
 * where the visitor was going), API routes answer 401.
 */
export function gate(pathname: string, search: string, signedIn: boolean): GateAction {
  if (pathname === SIGN_IN) return signedIn ? { kind: "redirect", to: HOME } : { kind: "next" };
  if (pathname === "/" && signedIn) return { kind: "redirect", to: HOME };
  const landing = LANDING_PAGES[pathname];
  if (landing) return { kind: "rewrite", to: landing };
  if (signedIn) return { kind: "next" };

  if (pathname.startsWith("/api/")) return { kind: "unauthorized" };
  const params = new URLSearchParams({ callbackUrl: pathname + search });
  return { kind: "redirect", to: `${SIGN_IN}?${params}` };
}
