"use client";

import React, { useEffect, useState } from "react";
import PhoneInput, {
  isValidPhoneNumber,
  isPossiblePhoneNumber,
  parsePhoneNumber,
  formatPhoneNumberIntl,
  type Country,
  type Flags,
} from "react-phone-number-input";
import * as flags from "country-flag-icons/react/3x2";
import "react-phone-number-input/style.css";
import styles from "./PhoneInputField.module.css";

/**
 * Validates a phone number using libphonenumber-js rules.
 * Handles numbers with or without a leading '+' by falling back to the current country.
 */
export function validatePhoneNumber(
  value?: string | null,
  defaultCountry: string = "IN"
): boolean {
  if (!value || typeof value !== "string") return false;
  const clean = value.trim();
  if (!clean) return false;

  if (clean.startsWith("+")) {
    return isValidPhoneNumber(clean);
  }

  try {
    const validCountry = (defaultCountry && defaultCountry.length === 2
      ? defaultCountry.toUpperCase()
      : "IN") as Country;
    const parsed = parsePhoneNumber(clean, validCountry);
    return Boolean(parsed && parsed.isValid());
  } catch {
    // Graceful fallback for unexpected formats
    return /^\+?[\d ()-]{7,25}$/.test(clean);
  }
}

export { formatPhoneNumberIntl, isValidPhoneNumber, isPossiblePhoneNumber };

export interface PhoneInputFieldProps {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  country?: string; // Auto-selected from delivery country (e.g. "IN", "US", "GB")
  error?: string;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  onBlur?: () => void;
  "aria-describedby"?: string;
}

/**
 * Modern Accessible Phone Input with Country Code Selector & As-You-Type Formatting.
 * - Auto-selects country code based on delivery country.
 * - Allows customer to change country code freely via dropdown.
 * - Formats number properly with international calling code as customer types.
 * - Adheres to WCAG 2.2 AA and Modern Web Guidance (:user-invalid, touch target >= 48px).
 */
export function PhoneInputField({
  id = "checkout-phone-input",
  name = "phone",
  value,
  onChange,
  country = "IN",
  error,
  required = false,
  disabled = false,
  placeholder = "98765 43210",
  className = "",
  onBlur,
  "aria-describedby": ariaDescribedby,
}: PhoneInputFieldProps) {
  // Normalize initial country code to 2-letter uppercase ISO
  const initialCountry = (
    country && country.length === 2 ? country.toUpperCase() : "IN"
  ) as Country;

  const [phoneCountry, setPhoneCountry] = useState<Country>(initialCountry);

  // Auto-sync phone country when parent delivery country changes
  useEffect(() => {
    if (country && country.length === 2) {
      setPhoneCountry(country.toUpperCase() as Country);
    }
  }, [country]);

  return (
    <div
      className={`${styles.wrapper} ${error ? styles.hasError : ""} ${className}`}
      data-testid="phone-input-field"
    >
      <PhoneInput
        id={id}
        name={name}
        international
        withCountryCallingCode
        country={phoneCountry}
        onCountryChange={(newCountry) => {
          if (newCountry) {
            setPhoneCountry(newCountry);
          }
        }}
        value={value || ""}
        onChange={(val) => {
          onChange(val || "");
        }}
        flags={flags as unknown as Flags}
        disabled={disabled}
        placeholder={placeholder}
        aria-label="Contact phone number with country code"
        aria-required={required}
        aria-invalid={Boolean(error)}
        aria-describedby={ariaDescribedby}
        onBlur={onBlur}
        numberInputProps={{
          id,
          name,
          required,
          autoComplete: "tel",
          inputMode: "tel",
          "aria-invalid": Boolean(error),
          "aria-describedby": ariaDescribedby,
        }}
      />
    </div>
  );
}
