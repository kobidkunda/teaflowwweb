// One navigation's preview choices live in memory, outside URLs and Web storage.
let pending: { brandName: string; quantityUnits: number } | null = null;
export function setStudioPreview(value: { brandName: string; quantityUnits: number }) {
  pending = { brandName: value.brandName.slice(0, 100), quantityUnits: value.quantityUnits };
}
export function consumeStudioPreview() {
  const value = pending;
  pending = null;
  return value;
}
