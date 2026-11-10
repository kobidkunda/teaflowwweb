/** Cart imagery is supplied by the catalogue, never guessed from product names. */
export function getCartItemImage(line: { imageUrl?: string | null }): string | null {
  return line.imageUrl?.trim() || null;
}

export function cartImageKey(line: { variantId: number; trialId?: string }): string {
  return line.trialId ? `trial-${line.trialId}` : `var-${line.variantId}`;
}
