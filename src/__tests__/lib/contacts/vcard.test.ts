import { buildVCard, vCardFilename } from "@/lib/contacts/vcard";
import { makeAddress, makeContact } from "../../mocks/handlers";

const PNG_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function lines(vcard: string) {
  return vcard.split("\r\n");
}

describe("buildVCard", () => {
  it("wraps the card and pins the version", () => {
    const out = lines(buildVCard(makeContact()));

    expect(out[0]).toBe("BEGIN:VCARD");
    expect(out[1]).toBe("VERSION:3.0");
    expect(out.at(-2)).toBe("END:VCARD");
    // The spec wants a trailing break.
    expect(buildVCard(makeContact()).endsWith("\r\n")).toBe(true);
  });

  it("writes the structured and formatted name", () => {
    const out = lines(buildVCard(makeContact()));

    expect(out).toContain("N:Lovelace;Ada;;;");
    expect(out).toContain("FN:Ada Lovelace");
  });

  it("emits one typed ADR per address, in positional order", () => {
    const contact = makeContact({
      addresses: [
        makeAddress({ id: 1, type: "work", street: "1 Market St", city: "San Francisco", state: "CA", postal_code: "94105", country: "USA" }),
        makeAddress({ id: 2, type: "home", street: "12 Ockham Rd", city: "London", state: null, postal_code: null, country: "UK" }),
      ],
    });

    const out = lines(buildVCard(contact));

    // po-box;extended;street;locality;region;postal;country
    expect(out).toContain("ADR;TYPE=WORK:;;1 Market St;San Francisco;CA;94105;USA");
    expect(out).toContain("ADR;TYPE=HOME:;;12 Ockham Rd;London;;;UK");
  });

  it("ships an 'other' address without an invalid TYPE parameter", () => {
    const contact = makeContact({
      addresses: [makeAddress({ type: "other", street: "PO Box 9", city: "Reno" })],
    });

    const out = lines(buildVCard(contact));

    // vCard 3.0 has no OTHER in its ADR type vocabulary.
    expect(out.some((line) => line.includes("TYPE=OTHER"))).toBe(false);
    expect(out.some((line) => line.startsWith("ADR:"))).toBe(true);
  });

  it("omits ADR entirely when the contact has no addresses", () => {
    const out = buildVCard(makeContact({ addresses: [] }));

    expect(out).not.toContain("ADR");
  });

  it("re-encodes the photo data URL as a base64 PHOTO property", () => {
    const out = buildVCard(makeContact({ photo: PNG_PIXEL }));

    expect(out).toContain("PHOTO;ENCODING=b;TYPE=PNG:");
    // The data: prefix must not survive into the vCard.
    expect(out).not.toContain("data:image/png;base64");
  });

  it("escapes the characters that would otherwise break the structure", () => {
    const out = buildVCard(
      makeContact({ notes: "Met at 5th, then 6th; see notes\\here" }),
    );

    // Written with explicit escapes: a bare "\\;" in a JS string is just ";",
    // which is how the missing semicolon escape slipped past this test before.
    expect(out).toContain(
      "NOTE:Met at 5th" + "\\," + " then 6th" + "\\;" + " see notes" + "\\\\" + "here",
    );
  });

  it("escapes a semicolon so it cannot split the value into fields", () => {
    const out = buildVCard(makeContact({ company: "Babbage; Lovelace" }));

    expect(out).toContain("ORG:Babbage" + "\\;" + " Lovelace");
    expect(out).not.toContain("ORG:Babbage; Lovelace");
  });

  it("turns a newline in a note into an escaped sequence, not a real break", () => {
    const out = buildVCard(makeContact({ notes: "line one\nline two" }));

    expect(out).toContain("\\nline two");
    expect(lines(out).some((line) => line === "line two")).toBe(false);
  });

  it("folds long lines to 75 octets with a leading space", () => {
    const out = lines(buildVCard(makeContact({ notes: "x".repeat(300) })));
    const folded = out.filter((line) => line.startsWith(" "));

    expect(folded.length).toBeGreaterThan(0);
    for (const line of out) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(75);
    }
  });

  it("never splits a multi-byte character across a fold", () => {
    const out = buildVCard(makeContact({ notes: "🎉".repeat(60) }));

    // A broken fold would leave replacement characters behind.
    expect(out).not.toContain("�");
  });
});

describe("vCardFilename", () => {
  it("slugifies the full name", () => {
    expect(vCardFilename(makeContact())).toBe("ada-lovelace.vcf");
  });

  it("falls back to the id when the name has nothing to slugify", () => {
    const contact = makeContact({ id: 7, first_name: "…", last_name: "…" });
    expect(vCardFilename(contact)).toBe("contact-7.vcf");
  });
});
