import type { CSSProperties } from "react";
import { avatarHue, initials } from "@/lib/contacts/format";
import type { Contact } from "@/lib/contacts/types";

const SIZES = {
  sm: "h-8 w-8 text-[11px]",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
} as const;

const SHAPE = "inline-flex aspect-square shrink-0 select-none rounded-full";

/**
 * The contact's photo, falling back to an initials bubble tinted with a hue
 * derived from their email.
 *
 * Decorative in both states: every call site already renders the contact's name
 * as text beside it, so announcing it again would only add noise.
 */
export default function ContactAvatar({
  contact,
  size = "md",
}: {
  contact: Pick<Contact, "first_name" | "last_name" | "email"> &
    Partial<Pick<Contact, "photo">>;
  size?: keyof typeof SIZES;
}) {
  if (contact.photo) {
    return (
      // Photos are base64 data URLs, so there is nothing for next/image to
      // optimise and its loader would reject the src outright.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={contact.photo}
        alt=""
        aria-hidden="true"
        className={`${SHAPE} border border-hairline object-cover ${SIZES[size]}`}
      />
    );
  }

  const style = {
    "--avatar-hue": avatarHue(contact.email),
  } as CSSProperties;

  return (
    <span
      aria-hidden="true"
      style={style}
      className={`contact-avatar ${SHAPE} items-center justify-center font-display font-semibold ${SIZES[size]}`}
    >
      {initials(contact)}
    </span>
  );
}
