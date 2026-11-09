import { describe, it, expect } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AdminAuthProvider,
  useAdminAuth,
  type AdminUser,
} from "../../src/components/admin/layout/AdminAuthContext";
import { AdminAuthGate } from "../../src/components/admin/catalog/AdminAuthGate";

function ConsumerComponent() {
  const auth = useAdminAuth();
  return React.createElement(
    "div",
    { id: "auth-status" },
    React.createElement("span", null, `Ready: ${String(auth.isProviderReady)}`),
    React.createElement("span", null, `Checking: ${String(auth.checking)}`),
    React.createElement("span", null, `Unlocked: ${String(auth.unlocked)}`),
    React.createElement("span", null, `User: ${auth.user?.username || "none"}`)
  );
}

describe("AdminAuthContext & AdminAuthProvider", () => {
  it("provides safe fallback values when used outside AdminAuthProvider", () => {
    const markup = renderToStaticMarkup(React.createElement(ConsumerComponent));
    expect(markup).toContain("Ready: false");
    expect(markup).toContain("Checking: false");
    expect(markup).toContain("Unlocked: false");
    expect(markup).toContain("User: none");
  });

  it("provides authenticated context immediately when initialUser is supplied", () => {
    const testUser: AdminUser = { username: "teamaster", role: "root" };
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminAuthProvider,
        { initialUser: testUser },
        React.createElement(ConsumerComponent)
      )
    );

    expect(markup).toContain("Ready: true");
    expect(markup).toContain("Checking: false");
    expect(markup).toContain("Unlocked: true");
    expect(markup).toContain("User: teamaster");
  });

  it("renders AdminAuthGate children directly with zero session-check delay when authenticated", () => {
    const testUser: AdminUser = { username: "darjeeling_admin", role: "admin" };
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminAuthProvider,
        { initialUser: testUser },
        React.createElement(
          AdminAuthGate,
          null,
          React.createElement("div", { id: "protected-panel" }, "Secret Admin Catalog")
        )
      )
    );

    // Shows children immediately without checking flash
    expect(markup).toContain('id="protected-panel"');
    expect(markup).toContain("Secret Admin Catalog");
    expect(markup).not.toContain("Checking your session…");
    expect(markup).toContain("Signed in as darjeeling_admin.");
    expect(markup).toContain("Sign out");
  });

  it("renders accessible sign-in form when unauthenticated", () => {
    const markup = renderToStaticMarkup(
      React.createElement(
        AdminAuthGate,
        null,
        React.createElement("div", { id: "protected-panel" }, "Secret Admin Catalog")
      )
    );

    // Protects children
    expect(markup).not.toContain("Secret Admin Catalog");
    // Displays sign-in form with required a11y attributes
    expect(markup).toContain("Store administration");
    expect(markup).toContain("Admin sign-in");
    expect(markup).toContain('aria-label="Admin sign-in"');
    expect(markup).toContain('name="username"');
    expect(markup).toContain('name="password"');
    expect(markup).toContain('type="submit"');
  });
});
