"use client";

import { LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { PasswordInput } from "@/components/password-input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import { GoogleIcon } from "./google-icon";
import { safeInternalPath } from "./safe-internal-path";

type Values = { identifier: string; password: string };

/** next-auth sends a failed Google sign-in back here with `?error=`; `AccessDenied` is our refusal. */
const GOOGLE_ERRORS: Record<string, string> = {
  AccessDenied: "This Google account can't sign in. Its email must be verified by Google.",
};
const GOOGLE_ERROR_FALLBACK = "Could not sign in with Google. Try again.";

const callbackUrl = () =>
  safeInternalPath(new URLSearchParams(window.location.search).get("callbackUrl"));

export function SignInForm({ google }: { google: boolean }) {
  const [entering, setEntering] = useState(false);
  const form = useForm<Values>({ defaultValues: { identifier: "", password: "" } });
  const busy = form.formState.isSubmitting || entering;

  // Once per error, even under Strict Mode's double effect.
  const shownError = useRef<string | null>(null);
  useEffect(() => {
    const error = new URLSearchParams(window.location.search).get("error");
    if (!error || shownError.current === error) return;
    shownError.current = error;
    toast.error(GOOGLE_ERRORS[error] ?? GOOGLE_ERROR_FALLBACK);
  }, []);

  const signInWithGoogle = () => {
    setEntering(true);
    // A redirect to Google and back; the page is left, so `entering` never needs resetting.
    void signIn("google", { callbackUrl: callbackUrl() });
  };

  const onSubmit = async (values: Values) => {
    // A network failure lands here too: to the user it is the same "could not sign in".
    const result = await signIn("credentials", { ...values, redirect: false }).catch(() => undefined);
    if (!result?.ok) {
      toast.error("Wrong email/username or password");
      return;
    }
    setEntering(true);
    // A full page load, not router.push(): the whole server tree has to render again with the new
    // session cookie (in the Fundsys app, refresh() + push() left the user stuck on /sign-in).
    window.location.assign(callbackUrl());
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <h1 className="mb-5 text-lg font-semibold tracking-tight text-foreground">Sign in</h1>

        {google && (
          <>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              disabled={busy}
              onClick={signInWithGoogle}
            >
              <GoogleIcon />
              Continue with Google
            </Button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              or
              <span className="h-px flex-1 bg-border" />
            </div>
          </>
        )}

        <FormField
          control={form.control}
          name="identifier"
          rules={{ required: "Enter your email or username." }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email or username</FormLabel>
              <FormControl>
                <Input
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  autoFocus={!google}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          rules={{ required: "Enter your password." }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>Password</FormLabel>
              <FormControl>
                <PasswordInput autoComplete="current-password" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={busy}>
          {busy && <LoaderCircle className="animate-spin" />}
          Sign in
        </Button>
      </form>
    </Form>
  );
}
