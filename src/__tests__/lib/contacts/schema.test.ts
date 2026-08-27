import {
  CONTACT_FIELDS,
  PHOTO_MAX_CHARS,
  PHOTO_TOO_LARGE,
  PHOTO_WRONG_TYPE,
  contactInputSchema,
  formDataToValues,
  zodFieldErrors,
} from "@/lib/contacts/schema";

const PNG_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function values(overrides: Record<string, string> = {}) {
  return {
    first_name: "Ada",
    last_name: "Lovelace",
    email: "Ada@Example.com",
    phone: "",
    company: "",
    job_title: "",
    photo: "",
    addresses: "[]",
    notes: "",
    ...overrides,
  };
}

describe("contactInputSchema", () => {
  it("lowercases the email and nulls out the blanks", () => {
    const parsed = contactInputSchema.parse(values());

    expect(parsed.email).toBe("ada@example.com");
    expect(parsed.phone).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it("trims what the user typed", () => {
    expect(contactInputSchema.parse(values({ company: "  Acme  " })).company).toBe(
      "Acme",
    );
  });

  it("requires the three fields the API requires", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: " ", last_name: "", email: "" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name is required",
      last_name: "Last name is required",
      email: "Email is required",
    });
  });

  it("rejects a malformed email", () => {
    const result = contactInputSchema.safeParse(values({ email: "not-an-email" }));
    expect(zodFieldErrors(result.error!).email).toBe("Enter a valid email address");
  });

  it("enforces the API's length limits", () => {
    const result = contactInputSchema.safeParse(
      values({ first_name: "a".repeat(101), company: "c".repeat(201) }),
    );

    expect(zodFieldErrors(result.error!)).toEqual({
      first_name: "First name must be 100 characters or fewer",
      company: "Company must be 200 characters or fewer",
    });
  });
});

describe("formDataToValues", () => {
  it("pulls every known field out, defaulting to an empty string", () => {
    const formData = new FormData();
    formData.set("first_name", "Grace");
    formData.set("email", "grace@example.com");
    formData.set("ignored", "nope");

    const extracted = formDataToValues(formData);

    expect(extracted.first_name).toBe("Grace");
    expect(extracted.last_name).toBe("");
    expect(Object.keys(extracted).sort()).toEqual(
      [...CONTACT_FIELDS.map((field) => field.name), "photo", "addresses"].sort(),
    );
  });

  it("carries the photo through, so a full PUT cannot silently drop it", () => {
    const formData = new FormData();
    formData.set("photo", PNG_PIXEL);

    expect(formDataToValues(formData).photo).toBe(PNG_PIXEL);
  });
});

describe("photo validation", () => {
  it("accepts an image data URL", () => {
    const result = contactInputSchema.safeParse(values({ photo: PNG_PIXEL }));

    expect(result.success).toBe(true);
    expect(result.data!.photo).toBe(PNG_PIXEL);
  });

  it("treats a blank photo as no photo", () => {
    const result = contactInputSchema.safeParse(values({ photo: "   " }));

    expect(result.success).toBe(true);
    expect(result.data!.photo).toBeNull();
  });

  it("rejects anything that is not an image data URL", () => {
    const result = contactInputSchema.safeParse(
      values({ photo: "https://example.com/ada.png" }),
    );

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).photo).toBe(PHOTO_WRONG_TYPE);
  });

  it("rejects an image past the size cap", () => {
    const oversized = `data:image/png;base64,${"A".repeat(PHOTO_MAX_CHARS)}`;
    const result = contactInputSchema.safeParse(values({ photo: oversized }));

    expect(result.success).toBe(false);
    expect(zodFieldErrors(result.error!).photo).toBe(PHOTO_TOO_LARGE);
  });
});
