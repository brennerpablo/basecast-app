"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * `useSession()` for the shell, seeded with the session the server already read, so it starts
 * signed in without a request. It is here for `update()`: after an edit on /account the token is
 * refreshed and every reader (the user menu, the page) sees the new name and photo at once.
 */
export function AuthSessionProvider({
  session,
  children,
}: {
  session: Session;
  children: ReactNode;
}) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}
