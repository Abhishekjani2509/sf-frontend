"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import { buildVCard, vCardFilename } from "@/lib/contacts/vcard";
import type { Contact } from "@/lib/contacts/types";

/**
 * Download the contact as a .vcf file.
 *
 * Built in the browser rather than served from a route: the contact is already
 * on the page, so a round trip would only re-fetch what we have.
 */
export default function ExportVCardButton({ contact }: { contact: Contact }) {
  const [failed, setFailed] = useState(false);

  function handleExport() {
    try {
      const blob = new Blob([buildVCard(contact)], {
        type: "text/vcard;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = vCardFilename(contact);
      document.body.appendChild(link);
      link.click();
      link.remove();

      // Release the blob once the download has been handed off.
      setTimeout(() => URL.revokeObjectURL(url), 0);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleExport}
        className={buttonClasses("secondary")}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        Export
      </button>
      {failed ? (
        <p role="alert" className="text-[13px] text-destructive">
          Could not build the vCard.
        </p>
      ) : null}
    </>
  );
}
