import Logo from "@/components/brand/logo";
import { Card } from "@/components/ui/card";
import { googleSignInEnabled } from "@/lib/auth";

import { SignInForm } from "./_components/sign-in-form";

/** `proxy.ts` sends visitors who already have a session to the app. */
export default function SignInPage() {
  return (
    <div className="flex w-full max-w-sm flex-col items-center">
      <div className="mb-7">
        <Logo size={36} />
      </div>
      <Card className="w-full p-8">
        <SignInForm google={googleSignInEnabled} />
      </Card>
    </div>
  );
}
