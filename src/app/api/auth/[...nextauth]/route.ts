import NextAuth from "next-auth";

import { authOptions } from "@/lib/auth";
import { withRequestLog } from "@/lib/observability";

const handler = withRequestLog(NextAuth(authOptions));

export { handler as GET, handler as POST };
