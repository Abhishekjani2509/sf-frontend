"use client";

import { useId, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import ContactAvatar from "./ContactAvatar";
import {
  PHOTO_ACCEPT,
  PHOTO_MAX_CHARS,
  PHOTO_MAX_DIMENSION,
  PHOTO_TOO_LARGE,
  PHOTO_WRONG_TYPE,
} from "@/lib/contacts/schema";
import type { Contact } from "@/lib/contacts/types";

const ACCEPTED = new Set(PHOTO_ACCEPT.split(","));

/** Canvas can re-encode these; a GIF would lose its animation on the round trip. */
const RESIZABLE = new Set(["image/png", "image/jpeg", "image/webp"]);

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("read failed"));
    reader.readAsDataURL(file);
  });
}

/** True if any pixel is not fully opaque, i.e. flattening to JPEG would show. */
function hasTransparency(context: CanvasRenderingContext2D, width: number, height: number) {
  const { data } = context.getImageData(0, 0, width, height);
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < 255) return true;
  }
  return false;
}

/**
 * Encode the canvas as small as it can go while still fitting the cap.
 *
 * PNG is lossless, so a downscaled photograph stays far too big — keeping the
 * source type would make any photo saved as a PNG impossible to upload. PNG is
 * therefore only used when the image actually has transparency to protect, and
 * even then JPEG wins if the PNG will not fit.
 */
function encodeWithinCap(canvas: HTMLCanvasElement, transparent: boolean): string {
  if (transparent) {
    const png = canvas.toDataURL("image/png");
    if (png.length <= PHOTO_MAX_CHARS) return png;
  }

  let jpeg = "";
  for (const quality of [0.85, 0.7, 0.55, 0.4]) {
    jpeg = canvas.toDataURL("image/jpeg", quality);
    if (jpeg.length <= PHOTO_MAX_CHARS) return jpeg;
  }
  // Still over: hand it back and let the caller report the size error.
  return jpeg;
}

/**
 * Shrink an image to `PHOTO_MAX_DIMENSION` on its longest edge, then encode it
 * as compactly as the cap requires.
 *
 * A phone photo is several MB and would blow the cap, but it is also being
 * rendered into a 56px circle — so the pixels are wasted twice over. Anything
 * canvas cannot safely re-encode falls back to the raw bytes and is left to the
 * size check.
 */
async function encodePhoto(file: File): Promise<string> {
  if (!RESIZABLE.has(file.type) || typeof createImageBitmap !== "function") {
    return readAsDataUrl(file);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return readAsDataUrl(file);
  }

  try {
    // Scale down only when oversized, but still re-encode either way: a small
    // image can be heavy, and the cap is about bytes rather than dimensions.
    const longest = Math.max(bitmap.width, bitmap.height);
    const scale = longest > PHOTO_MAX_DIMENSION ? PHOTO_MAX_DIMENSION / longest : 1;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return readAsDataUrl(file);

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const transparent =
      file.type !== "image/jpeg" && hasTransparency(context, canvas.width, canvas.height);

    return encodeWithinCap(canvas, transparent);
  } finally {
    bitmap.close();
  }
}

/**
 * Photo picker for the contact form.
 *
 * The chosen image is base64-encoded in the browser and submitted through a
 * hidden `photo` input. That hidden input is what makes editing safe: the form
 * saves with a full `PUT`, so if the current photo were not resubmitted here it
 * would be erased on every unrelated edit.
 */
export default function ContactPhotoField({
  contact,
  defaultValue,
  error,
  onBusyChange,
}: {
  contact?: Contact;
  defaultValue?: string;
  error?: string;
  /** Lets the form block submission while an image is still being encoded. */
  onBusyChange?: (busy: boolean) => void;
}) {
  const [photo, setPhoto] = useState<string | null>(defaultValue || null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Encoding is async, so a slow pick can land after a newer pick or a remove.
  // Every selection takes a ticket; only the current ticket may write state.
  const ticketRef = useRef(0);

  const id = useId();
  const errorId = `${id}-error`;
  const message = localError ?? error;

  function setBusyState(next: boolean) {
    setBusy(next);
    onBusyChange?.(next);
  }

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Let the same file be re-picked after a remove.
    event.target.value = "";
    if (!file) return;

    const ticket = (ticketRef.current += 1);

    if (!ACCEPTED.has(file.type)) {
      setLocalError(PHOTO_WRONG_TYPE);
      // Taking a ticket above superseded any encode still running, so nothing
      // is left to finish — clear busy here or the form stays locked forever.
      setBusyState(false);
      return;
    }

    setBusyState(true);
    try {
      const dataUrl = await encodePhoto(file);
      if (ticket !== ticketRef.current) return; // superseded — drop the result

      if (dataUrl.length > PHOTO_MAX_CHARS) {
        setLocalError(PHOTO_TOO_LARGE);
        return;
      }
      setLocalError(null);
      setPhoto(dataUrl);
    } catch {
      if (ticket === ticketRef.current) {
        setLocalError("That image could not be read. Try another file.");
      }
    } finally {
      if (ticket === ticketRef.current) setBusyState(false);
    }
  }

  function handleRemove() {
    // Invalidate anything in flight so it cannot resurrect the photo.
    ticketRef.current += 1;
    setPhoto(null);
    setLocalError(null);
    setBusyState(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  // The name/email only feed the initials fallback and its hue.
  const preview = {
    first_name: contact?.first_name ?? "",
    last_name: contact?.last_name ?? "",
    email: contact?.email ?? "",
    photo,
  };

  return (
    <div className="sm:col-span-2">
      {/* No label here: the enclosing fieldset is already headed "Photo", and
          the file input carries its own accessible name. */}
      <div className="flex items-center gap-4">
        <ContactAvatar contact={preview} size="lg" />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className={buttonClasses("secondary")}
            aria-describedby={message ? errorId : undefined}
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            {busy ? "Processing…" : photo ? "Change photo" : "Add photo"}
          </button>

          {photo ? (
            <button
              type="button"
              onClick={handleRemove}
              className={buttonClasses("secondary")}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove
            </button>
          ) : (
            <p className="text-[13px] text-muted-foreground">
              Falls back to initials.
            </p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPT}
        onChange={handleChange}
        className="sr-only"
        aria-label="Choose a profile photo"
        aria-invalid={message ? true : undefined}
        aria-describedby={message ? errorId : undefined}
      />

      {/* Carries the photo through submit — including an unchanged one. */}
      <input type="hidden" name="photo" value={photo ?? ""} />

      {message ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1.5 text-[13px] text-destructive"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
