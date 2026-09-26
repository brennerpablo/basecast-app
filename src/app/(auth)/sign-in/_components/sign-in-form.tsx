"use client";

import { LoaderCircle } from "lucide-react";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

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

import { safeInternalPath } from "./safe-internal-path";

type Values = { identifier: string; password: string };

export function SignInForm() {
  const [entering, setEntering] = useState(false);
  const form = useForm<Values>({ defaultValues: { identifier: "", password: "" } });
  const busy = form.formState.isSubmitting || entering;

  const onSubmit = async (values: Values) => {
    // A network failure lands here too: to the user it is the same "could not sign in".
    const result = await signIn("credentials", { ...values, redirect: false }).catch(() => undefined);
    if (!result?.ok) {
      toast.error("Couldn't sign in", {
        description: "Check your email or username and password.",
      });
      return;
    }
    setEntering(true);
    // A full page load, not router.push(): the whole server tree has to render again with the new
    // session cookie (in the Fundsys app, refresh() + push() left the user stuck on /sign-in).
    const callbackUrl = new URLSearchParams(window.location.search).get("callbackUrl");
    window.location.assign(safeInternalPath(callbackUrl));
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="mb-5">
          <h1 className="text-lg font-semibold tracking-tight text-foreground">Sign in</h1>
          <p className="mt-1 text-sm text-muted-foreground">Use your email or username.</p>
        </div>

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
                  autoFocus
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
                <Input type="password" autoComplete="current-password" {...field} />
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
