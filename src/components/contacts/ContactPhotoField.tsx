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

/**
 * Shrink an image to `PHOTO_MAX_DIMENSION` on its longest edge before encoding.
 *
 * A phone photo is several MB and would blow the size cap, but it is also being
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
    const longest = Math.max(bitmap.width, bitmap.height);
    if (longest <= PHOTO_MAX_DIMENSION) return readAsDataUrl(file);

    const scale = PHOTO_MAX_DIMENSION / longest;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);

    const context = canvas.getContext("2d");
    if (!context) return readAsDataUrl(file);

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    // Keep PNG/WebP so transparency survives the circular crop; everything else
    // is a photograph, where JPEG is dramatically smaller at the same quality.
    const type = file.type === "image/jpeg" ? "image/jpeg" : file.type;
    return canvas.toDataURL(type, 0.85);
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
}: {
  contact?: Contact;
  defaultValue?: string;
  error?: string;
}) {
  const [photo, setPhoto] = useState<string | null>(defaultValue || null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const id = useId();
  const errorId = `${id}-error`;
  const message = localError ?? error;

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED.has(file.type)) {
      setLocalError(PHOTO_WRONG_TYPE);
      event.target.value = "";
      return;
    }

    try {
      const dataUrl = await encodePhoto(file);
      if (dataUrl.length > PHOTO_MAX_CHARS) {
        setLocalError(PHOTO_TOO_LARGE);
        event.target.value = "";
        return;
      }
      setLocalError(null);
      setPhoto(dataUrl);
    } catch {
      setLocalError("That image could not be read. Try another file.");
    } finally {
      // Let the same file be re-picked after a remove.
      event.target.value = "";
    }
  }

  function handleRemove() {
    setPhoto(null);
    setLocalError(null);
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
      <span className="mb-1.5 block text-[13px] font-medium text-foreground">
        Photo
        <span className="ml-1.5 text-[11px] font-normal text-muted-foreground">
          optional
        </span>
      </span>

      <div className="flex items-center gap-4">
        <ContactAvatar contact={preview} size="lg" />

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className={buttonClasses("secondary")}
            aria-describedby={message ? errorId : undefined}
          >
            <ImagePlus className="h-4 w-4" aria-hidden="true" />
            {photo ? "Change photo" : "Add photo"}
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
