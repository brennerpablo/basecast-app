"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import { type Ref, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type PasswordInputProps = React.ComponentProps<"input"> & {
  ref?: Ref<HTMLInputElement>;
};

/** Password field with an eye button that shows or hides the value, as in the Fundsys app. */
function PasswordInput({ className, ref, ...props }: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const disabled = props.value === "" || props.value === undefined || props.disabled;

  return (
    <div className="relative">
      <Input
        type={showPassword ? "text" : "password"}
        className={cn("hide-password-toggle pr-10", className)}
        ref={ref}
        {...props}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
        onClick={() => setShowPassword((prev) => !prev)}
        disabled={disabled}
      >
        {showPassword && !disabled ? (
          <EyeIcon className="size-4" aria-hidden="true" />
        ) : (
          <EyeOffIcon className="size-4" aria-hidden="true" />
        )}
        <span className="sr-only">{showPassword ? "Hide password" : "Show password"}</span>
      </Button>

      {/* Hides the browser's own reveal button (Edge), so there is only one eye. */}
      <style>{`
        .hide-password-toggle::-ms-reveal,
        .hide-password-toggle::-ms-clear {
          visibility: hidden;
          pointer-events: none;
          display: none;
        }
      `}</style>
    </div>
  );
}

export { PasswordInput };
