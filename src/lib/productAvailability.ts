import { getDb } from "@/lib/db";

/** Works with bootstrap fixtures as well as the versioned catalogue schema. */
export function enabledProductCondition(alias?: "p"): string {
  const columns = getDb().prepare("PRAGMA table_info(products)").all() as { name: string }[];
  return columns.some((column) => column.name === "is_enabled")
    ? `${alias ? alias + "." : ""}is_enabled = 1`
    : "1 = 1";
}
