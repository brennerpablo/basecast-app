"use client";

import { AtSign, Check, Pencil, UserRound, X } from "lucide-react";
import { useSession } from "next-auth/react";
import { type ElementType, type ReactNode, useState } from "react";
import { toast } from "sonner";

import { AvatarUpload } from "@/components/avatar-upload/avatar-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AVATAR_SIZE, DISPLAY_NAME_MAX, normalizeDisplayName } from "@/lib/account/profile";
import { BRAND } from "@/lib/brand-tokens";

/** Sends a request to the account routes; throws with the route's own message when it fails. */
async function send(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  if (response.ok) return;
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  throw new Error(body?.error ?? "Something went wrong. Try again.");
}

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Something went wrong. Try again.";

/**
 * The account screen, laid out as in the Fundsys app: a banner with the photo,
 * name and email, then the account details, with the display name edited in
 * place. After each edit `update()` refreshes the session token from the
 * database, so the user menu follows at once.
 */
export function AccountView() {
  const { data: session, update } = useSession();
  const [avatarBusy, setAvatarBusy] = useState(false);
  if (!session) return null;

  const { name, username, email, image } = session.user;
  const displayName = name || username;

  async function uploadAvatar(file: File) {
    setAvatarBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      await send("/api/account/avatar", { method: "PUT", body: form });
      await update();
      toast.success("Photo updated");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAvatarBusy(false);
    }
  }

  async function removeAvatar() {
    setAvatarBusy(true);
    try {
      await send("/api/account/avatar", { method: "DELETE" });
      await update();
      toast.success("Photo removed");
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setAvatarBusy(false);
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Forest green in every theme, as the Fundsys banner is slate in
          every theme: the photo and the lime initials sit on a dark ground. */}
      <div
        className="mb-6 rounded-xl p-6"
        style={{ backgroundImage: `linear-gradient(90deg, ${BRAND[800]}, ${BRAND.DEFAULT})` }}
      >
        <div className="flex items-center gap-5">
          <div className="w-fit rounded-full shadow-md ring-4 ring-white/90">
            <AvatarUpload
              image={image}
              name={displayName}
              size={80}
              outputSize={AVATAR_SIZE}
              onUpload={uploadAvatar}
              onRemove={image ? removeAvatar : undefined}
              loading={avatarBusy}
            />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-semibold text-white">{displayName}</h2>
            <p className="mt-0.5 truncate text-sm text-white/70">{email}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="divide-y px-5">
          <InfoRow icon={UserRound} label="Display name">
            <EditNameField currentName={name ?? ""} onSaved={() => update()} />
          </InfoRow>
          <InfoRow icon={AtSign} label="Username">
            <span className="text-sm">{username}</span>
          </InfoRow>
        </div>
      </div>
    </div>
  );
}

/** The display name, edited in place: pencil to start, Enter or ✓ to save, Esc or ✕ to cancel. */
function EditNameField({
  currentName,
  onSaved,
}: {
  currentName: string;
  onSaved: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName);
  const [saving, setSaving] = useState(false);

  function startEditing() {
    setValue(currentName);
    setEditing(true);
  }

  async function save() {
    const result = normalizeDisplayName(value);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    if (result.name === currentName) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await send("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: result.name }),
      });
      await onSaved();
      toast.success("Name updated");
      setEditing(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="group flex items-center gap-2">
        <span className="text-sm">{currentName || "—"}</span>
        <Button
          variant="ghost"
          size="icon"
          className="size-6 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          onClick={startEditing}
          aria-label="Edit name"
        >
          <Pencil className="size-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={DISPLAY_NAME_MAX}
        className="h-8 w-64 text-sm"
        aria-label="Display name"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") void save();
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-basecast-brand hover:bg-basecast-brand-surface hover:text-basecast-brand"
        onClick={() => void save()}
        disabled={saving}
        aria-label="Save name"
      >
        <Check className="size-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-7 text-muted-foreground"
        onClick={() => setEditing(false)}
        disabled={saving}
        aria-label="Cancel editing"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  children,
}: {
  icon: ElementType;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-start gap-4 py-4">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        {children}
      </div>
    </div>
  );
}
