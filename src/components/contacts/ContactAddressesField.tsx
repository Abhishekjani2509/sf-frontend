"use client";

import { useId, useState } from "react";
import { MapPin, Plus, Trash2 } from "lucide-react";
import { buttonClasses } from "@/components/ui/Button";
import {
  ADDRESS_TYPES,
  ADDRESS_TYPE_LABELS,
  type AddressInput,
  type AddressType,
} from "@/lib/contacts/types";

const CONTROL =
  "w-full rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary focus:bg-input";

const PARTS: {
  name: keyof Omit<AddressInput, "type">;
  label: string;
  placeholder: string;
  max: number;
  wide?: boolean;
}[] = [
  { name: "street", label: "Street address", placeholder: "1 Market St, Suite 400", max: 300, wide: true },
  { name: "city", label: "City", placeholder: "San Francisco", max: 120 },
  { name: "state", label: "State / region", placeholder: "CA", max: 120 },
  { name: "postal_code", label: "Postal code", placeholder: "94105", max: 20 },
  { name: "country", label: "Country", placeholder: "USA", max: 120 },
];

function blankAddress(): AddressInput {
  return { type: "home", street: null, city: null, state: null, postal_code: null, country: null };
}

/**
 * Add, edit, and remove any number of typed addresses.
 *
 * The rows are dynamic, so they cannot be described by a static
 * `ContactFieldSpec`. Instead the whole set is serialised into one hidden
 * `addresses` input as JSON, which `addressesFieldSchema` parses back out.
 */
export default function ContactAddressesField({
  defaultValue,
  error,
}: {
  defaultValue?: AddressInput[];
  error?: string;
}) {
  const [addresses, setAddresses] = useState<AddressInput[]>(defaultValue ?? []);
  const id = useId();
  const errorId = `${id}-error`;

  function update(index: number, patch: Partial<AddressInput>) {
    setAddresses((current) =>
      current.map((address, i) => (i === index ? { ...address, ...patch } : address)),
    );
  }

  function remove(index: number) {
    setAddresses((current) => current.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-4">
      {addresses.length === 0 ? (
        <p className="flex items-center gap-2 rounded-md border border-dashed border-border px-3 py-4 text-[13px] text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          No addresses yet. A contact can have as many as you need.
        </p>
      ) : null}

      {addresses.map((address, index) => (
        <fieldset
          key={index}
          className="space-y-3 rounded-md border border-border p-4"
        >
          <legend className="sr-only">Address {index + 1}</legend>

          <div className="flex items-center justify-between gap-3">
            <div>
              <label
                htmlFor={`${id}-type-${index}`}
                className="mb-1.5 block text-[13px] font-medium text-foreground"
              >
                Type
              </label>
              <select
                id={`${id}-type-${index}`}
                value={address.type}
                onChange={(event) =>
                  update(index, { type: event.target.value as AddressType })
                }
                className={CONTROL}
              >
                {ADDRESS_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {ADDRESS_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => remove(index)}
              className={buttonClasses("secondary")}
              aria-label={`Remove address ${index + 1}`}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Remove
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PARTS.map((part) => (
              <div key={part.name} className={part.wide ? "sm:col-span-2" : undefined}>
                <label
                  htmlFor={`${id}-${part.name}-${index}`}
                  className="mb-1.5 block text-[13px] font-medium text-foreground"
                >
                  {part.label}
                </label>
                <input
                  id={`${id}-${part.name}-${index}`}
                  value={address[part.name] ?? ""}
                  maxLength={part.max}
                  placeholder={part.placeholder}
                  onChange={(event) =>
                    update(index, { [part.name]: event.target.value || null })
                  }
                  className={CONTROL}
                />
              </div>
            ))}
          </div>
        </fieldset>
      ))}

      <button
        type="button"
        onClick={() => setAddresses((current) => [...current, blankAddress()])}
        className={buttonClasses("secondary")}
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        Add address
      </button>

      {/* The whole set travels as one JSON value; see addressesFieldSchema. */}
      <input type="hidden" name="addresses" value={JSON.stringify(addresses)} />

      {error ? (
        <p id={errorId} role="alert" className="text-[13px] text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
