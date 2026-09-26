import Logo from "@/components/brand/logo";
import { Card } from "@/components/ui/card";

import { SignInForm } from "./_components/sign-in-form";

/** Only reachable in ACCESS_MODE=login; `proxy.ts` sends it to the app otherwise. */
export default function SignInPage() {
  return (
    <div className="flex w-full max-w-sm flex-col items-center">
      <div className="mb-7">
        <Logo size={36} />
      </div>
      <Card className="w-full p-8">
        <SignInForm />
      </Card>
    </div>
  );
}
