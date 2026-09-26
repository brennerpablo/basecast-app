import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    username: string;
    isSuperAdmin: boolean;
  }

  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      username: string;
      isSuperAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    username: string;
    isSuperAdmin: boolean;
  }
}
