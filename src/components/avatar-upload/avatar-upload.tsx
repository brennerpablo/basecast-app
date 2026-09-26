"use client";

import { Camera, X } from "lucide-react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials } from "@/lib/utils/initials";

import { ImageCropDialog } from "./image-crop-dialog";

/**
 * A round photo that opens the crop dialog on click, with a ✕ to remove it, as
 * in the Fundsys app. Without a photo it shows the initials on the brand fill.
 */
export function AvatarUpload({
  image,
  name,
  size = 80,
  outputSize,
  onUpload,
  onRemove,
  loading = false,
}: {
  image?: string | null;
  name: string;
  /** Rendered size, in px. */
  size?: number;
  /** Side of the cropped square that is uploaded, in px. */
  outputSize: number;
  onUpload: (file: File) => void;
  /** Leave out when there is nothing to remove. */
  onRemove?: () => void;
  loading?: boolean;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);

  if (loading) {
    return <Skeleton className="rounded-full" style={{ width: size, height: size }} />;
  }

  return (
    <>
      <div className="relative" style={{ width: size, height: size }}>
        <button
          type="button"
          className="group relative size-full rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={() => setDialogOpen(true)}
          aria-label="Change photo"
        >
          <Avatar className="size-full">
            {image ? <AvatarImage src={image} alt={name} className="object-cover" /> : null}
            <AvatarFallback
              className="bg-brand font-semibold text-brand-foreground"
              style={{ fontSize: Math.round(size * 0.32) }}
            >
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            <Camera className="text-white" style={{ width: size * 0.3, height: size * 0.3 }} />
          </span>
        </button>

        {image && onRemove ? (
          <button
            type="button"
            className="absolute -right-1 -top-1 flex items-center justify-center rounded-full border border-border bg-card text-foreground shadow-sm transition-colors hover:bg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ width: Math.round(size * 0.28), height: Math.round(size * 0.28) }}
            onClick={onRemove}
            aria-label="Remove photo"
          >
            <X style={{ width: Math.round(size * 0.15), height: Math.round(size * 0.15) }} />
          </button>
        ) : null}
      </div>

      <ImageCropDialog
        open={dialogOpen}
        size={outputSize}
        onClose={() => setDialogOpen(false)}
        onConfirm={(file) => {
          onUpload(file);
          setDialogOpen(false);
        }}
      />
    </>
  );
}
