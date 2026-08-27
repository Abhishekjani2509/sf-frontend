import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContactPhotoField from "@/components/contacts/ContactPhotoField";

const PNG_PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function pngFile(name = "avatar.png") {
  return new File(["x"], name, { type: "image/png" });
}

function fileInput() {
  return screen.getByLabelText(/choose a profile photo/i);
}

function hiddenPhoto(container: HTMLElement) {
  return container.querySelector<HTMLInputElement>('input[name="photo"]')!;
}

describe("ContactPhotoField", () => {
  it("submits the existing photo unchanged, so a full PUT cannot drop it", () => {
    const { container } = render(<ContactPhotoField defaultValue={PNG_PIXEL} />);

    expect(hiddenPhoto(container).value).toBe(PNG_PIXEL);
  });

  it("clears the photo when removed", async () => {
    const { container } = render(<ContactPhotoField defaultValue={PNG_PIXEL} />);

    await userEvent.click(screen.getByRole("button", { name: /remove/i }));

    expect(hiddenPhoto(container).value).toBe("");
  });

  it("rejects a disallowed file type without keeping the form busy", async () => {
    const onBusyChange = jest.fn();
    render(<ContactPhotoField onBusyChange={onBusyChange} />);

    // applyAccept:false so the file reaches our handler — otherwise userEvent
    // filters it on the input's `accept` and the guard never runs.
    await userEvent.upload(
      fileInput(),
      new File(["x"], "notes.pdf", { type: "application/pdf" }),
      { applyAccept: false },
    );

    expect(await screen.findByRole("alert")).toBeInTheDocument();
    // The form must never be left locked by a rejected pick.
    expect(onBusyChange.mock.calls.at(-1)?.[0]).toBe(false);
  });

  it("does not leave the form busy once an encode settles", async () => {
    const onBusyChange = jest.fn();
    render(<ContactPhotoField onBusyChange={onBusyChange} />);

    await userEvent.upload(fileInput(), pngFile());

    await waitFor(() =>
      expect(onBusyChange.mock.calls.at(-1)?.[0]).toBe(false),
    );
  });
});
