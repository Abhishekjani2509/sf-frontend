import type { Contact } from "./types";

/**
 * vCard 3.0 export.
 *
 * 3.0 rather than 4.0 because it is what Apple Contacts, Google Contacts, and
 * Outlook all import without complaint — 4.0 support is still patchy.
 */

/** ADR types the 3.0 grammar allows; anything else ships without a TYPE. */
const ADR_TYPES: Record<string, string | null> = {
  home: "HOME",
  work: "WORK",
  other: null,
};

/** Escape the characters that carry structural meaning inside a value. */
function escapeValue(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Fold to 75 octets per line, as the spec requires.
 *
 * Measured in UTF-8 bytes, not characters, and never split mid-character —
 * an emoji in a note would otherwise be cut in half and corrupt the file.
 * Continuation lines start with a single space.
 */
function foldLine(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;

  const chunks: string[] = [];
  const decoder = new TextDecoder();
  let start = 0;
  let limit = 75;

  while (start < bytes.length) {
    let end = Math.min(start + limit, bytes.length);
    // Walk back off a continuation byte so a multi-byte character stays whole.
    while (end > start && end < bytes.length && (bytes[end] & 0b1100_0000) === 0b1000_0000) {
      end -= 1;
    }
    chunks.push(decoder.decode(bytes.subarray(start, end)));
    start = end;
    limit = 74; // subsequent lines lose one octet to the leading space
  }

  return chunks.join("\r\n ");
}

/** `data:image/png;base64,AAA` → `PHOTO;ENCODING=b;TYPE=PNG:AAA` */
function photoLine(photo: string): string | null {
  const match = /^data:image\/(png|jpeg|gif|webp);base64,(.+)$/.exec(photo);
  if (!match) return null;
  return `PHOTO;ENCODING=b;TYPE=${match[1].toUpperCase()}:${match[2]}`;
}

export function buildVCard(contact: Contact): string {
  const lines: string[] = ["BEGIN:VCARD", "VERSION:3.0"];

  // Structured name: family;given;additional;prefix;suffix
  lines.push(`N:${escapeValue(contact.last_name)};${escapeValue(contact.first_name)};;;`);
  lines.push(`FN:${escapeValue(contact.full_name)}`);

  if (contact.company) lines.push(`ORG:${escapeValue(contact.company)}`);
  if (contact.job_title) lines.push(`TITLE:${escapeValue(contact.job_title)}`);
  lines.push(`EMAIL;TYPE=INTERNET:${escapeValue(contact.email)}`);
  if (contact.phone) lines.push(`TEL;TYPE=VOICE:${escapeValue(contact.phone)}`);

  // ADR is positional: po-box;extended;street;locality;region;postal;country
  for (const address of contact.addresses) {
    const parts = [
      "",
      "",
      address.street ?? "",
      address.city ?? "",
      address.state ?? "",
      address.postal_code ?? "",
      address.country ?? "",
    ].map(escapeValue);
    // vCard 3.0 fixes the ADR type vocabulary (dom, intl, postal, parcel,
    // home, work, pref). "OTHER" is not in it, so that case ships without a
    // TYPE parameter rather than with an invalid one.
    const type = ADR_TYPES[address.type];
    lines.push(`ADR${type ? `;TYPE=${type}` : ""}:${parts.join(";")}`);
  }

  if (contact.photo) {
    const photo = photoLine(contact.photo);
    if (photo) lines.push(photo);
  }

  if (contact.notes) lines.push(`NOTE:${escapeValue(contact.notes)}`);
  lines.push(`REV:${new Date(contact.updated_at).toISOString()}`);
  lines.push("END:VCARD");

  // CRLF throughout, including a trailing break, per the spec.
  return `${lines.map(foldLine).join("\r\n")}\r\n`;
}

/** `Ada Lovelace` → `ada-lovelace.vcf` */
export function vCardFilename(contact: Contact): string {
  const slug =
    contact.full_name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `contact-${contact.id}`;
  return `${slug}.vcf`;
}
