/** Upgrade only known starter art. Uploaded/operator-selected images are preserved. */
export function tradeImage(
  value: string | null | undefined,
  slot: "hero" | "trial",
) {
  if (!value || value === "/images/trials/discovery-shelf-hero.webp")
    return slot === "hero"
      ? "/images/trade/counter-ritual-hero.webp"
      : "/images/trade/counter-ritual-pouches.webp";
  return value;
}
