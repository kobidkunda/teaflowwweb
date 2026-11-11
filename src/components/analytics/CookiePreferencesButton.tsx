"use client";

import React from "react";

interface CookiePreferencesButtonProps {
  className?: string;
  children?: React.ReactNode;
}

export function CookiePreferencesButton({
  className = "tf-footer-bottom-link",
  children = "Cookie Preferences",
}: CookiePreferencesButtonProps) {
  return (
    <button
      type="button"
      className={className}
      style={{
        background: "transparent",
        border: "none",
        padding: 0,
        font: "inherit",
        fontSize: "inherit",
        color: "inherit",
        cursor: "pointer",
        textAlign: "left",
      }}
      onClick={() => {
        window.dispatchEvent(new CustomEvent("open-cookie-settings"));
      }}
      aria-label="Manage cookie and privacy preferences"
    >
      {children}
    </button>
  );
}
