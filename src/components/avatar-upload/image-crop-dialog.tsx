"use client";

import "react-image-crop/dist/ReactCrop.css";

import { useRef, useState } from "react";
import ReactCrop, { centerCrop, type Crop, makeAspectCrop, type PercentCrop } from "react-image-crop";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Picks an image and crops a square out of it, as in the Fundsys app. The crop
 * leaves as a `size`×`size` WebP (PNG where the browser cannot encode WebP), so
 * a phone photo of several MB becomes a few dozen KB before it is sent.
 */
export function ImageCropDialog({
  open,
  onClose,
  onConfirm,
  size,
  title = "Crop photo",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (file: File) => void;
  /** Side of the square that leaves, in px. */
  size: number;
  title?: string;
}) {
  const [imgSrc, setImgSrc] = useState("");
  const [crop, setCrop] = useState<Crop>();
  const imgRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setImgSrc(reader.result as string);
    reader.readAsDataURL(file);
  }

  function handleClose() {
    setImgSrc("");
    setCrop(undefined);
    if (fileInputRef.current) fileInputRef.current.value = "";
    onClose();
  }

  function handleConfirm() {
    const img = imgRef.current;
    if (!img || !crop || crop.width === 0) return;

    // The crop is always a PercentCrop (onChange stores percentCrop), so it
    // maps straight to the image's natural pixels.
    const pct = crop as PercentCrop;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    canvas.getContext("2d")?.drawImage(
      img,
      (pct.x / 100) * img.naturalWidth,
      (pct.y / 100) * img.naturalHeight,
      (pct.width / 100) * img.naturalWidth,
      (pct.height / 100) * img.naturalHeight,
      0,
      0,
      size,
      size,
    );
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        // `blob.type` says what the browser actually encoded.
        onConfirm(new File([blob], "avatar", { type: blob.type }));
        handleClose();
      },
      "image/webp",
      0.9,
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Pick an image and drag the square over the part to keep.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {!imgSrc ? (
            <button
              type="button"
              className="flex w-full cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-border py-12 transition-colors hover:border-muted-foreground"
              onClick={() => fileInputRef.current?.click()}
            >
              <p className="text-sm text-muted-foreground">Click to choose an image</p>
              <p className="text-xs text-muted-foreground/70">PNG, JPEG or WebP</p>
            </button>
          ) : (
            <div className="flex justify-center">
              <ReactCrop
                crop={crop}
                onChange={(_, percentCrop) => setCrop(percentCrop)}
                aspect={1}
                circularCrop
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- ReactCrop needs a raw <img ref>; next/image does not work with it */}
                <img
                  ref={imgRef}
                  src={imgSrc}
                  alt="Crop preview"
                  className="max-h-80 max-w-full"
                  onLoad={(e) => {
                    const { naturalWidth, naturalHeight } = e.currentTarget;
                    setCrop(
                      centerCrop(
                        makeAspectCrop({ unit: "%", width: 90 }, 1, naturalWidth, naturalHeight),
                        naturalWidth,
                        naturalHeight,
                      ),
                    );
                  }}
                />
              </ReactCrop>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            aria-label="Choose an image"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          {imgSrc && (
            <Button
              variant="outline"
              size="sm"
              className="self-start"
              onClick={() => fileInputRef.current?.click()}
            >
              Choose another image
            </Button>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!crop || crop.width === 0}>
            Save photo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
