import React from "react";
import { render, screen } from "@testing-library/react";
import ContactAvatar from "@/components/contacts/ContactAvatar";
import { makeContact } from "../mocks/handlers";

const PNG_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("ContactAvatar", () => {
  it("falls back to initials when the contact has no photo", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: null })} />,
    );

    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(container.querySelector("img")).toBeNull();
  });

  it("renders the photo when there is one", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PNG_PIXEL })} />,
    );

    const image = container.querySelector("img");
    expect(image).toHaveAttribute("src", PNG_PIXEL);
    expect(screen.queryByText("AL")).not.toBeInTheDocument();
  });

  it("keeps the photo circular and uncropped at every size", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PNG_PIXEL })} size="lg" />,
    );

    const image = container.querySelector("img")!;
    expect(image).toHaveClass("rounded-full", "object-cover", "aspect-square");
    expect(image).toHaveClass("h-14", "w-14");
  });

  it("stays decorative, since the name is always rendered alongside it", () => {
    const { container } = render(
      <ContactAvatar contact={makeContact({ photo: PNG_PIXEL })} />,
    );

    expect(container.querySelector("img")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });
});
