import { describe, it, expect, vi } from "vitest";
import { wrapRow } from "@/lib/postgresDriver";

// Simulate the Postgres driver: every row returned by getDb() is Proxy-wrapped via wrapRow().
const state: { published: string | null; hash: string | null } = { published: null, hash: null };
vi.mock("@/lib/db", () => ({
  getDb: () => ({
    prepare: (sql: string) => ({
      get: () => {
        if (sql.includes("commerce_translations")) return wrapRow({ id: "t1", resource: "category:7", locale: "bn", published: state.published, published_hash: state.hash } as Record<string, unknown>);
        if (sql.includes("FROM categories")) return wrapRow({ id: 7, slug: "black", name: "Black Tea" } as Record<string, unknown>);
        return undefined;
      },
      all: () => [],
    }),
  }),
}));

describe("localize with Postgres Proxy rows", () => {
  it("clones Proxy-wrapped rows without DataCloneError and applies translations", async () => {
    const { localize, sourceFor } = await import("@/lib/international/translations");
    const { hash } = await import("@/lib/international/quotes");
    state.published = JSON.stringify({ name: "ব্ল্যাক টি" });
    state.hash = hash(sourceFor("category:7"));
    const created = new Date(0);
    const row = wrapRow({ id: 7, slug: "black", name: "Black Tea", created_at: created } as Record<string, unknown>);
    expect(() => structuredClone(row)).toThrow();
    const localized = localize(row, "category:7", "bn") as Record<string, unknown>;
    expect(localized.name).toBe("ব্ল্যাক টি");
    expect(localized.created_at).toEqual(created);
    expect(localized.created_at).not.toBe(created);
    expect(row.name).toBe("Black Tea");
  });
});
