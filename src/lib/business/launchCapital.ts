export function calculateLaunchCapital(amounts: string[]) {
  if (!amounts.length || amounts.some(amount => !/^\d+(?:\.\d{1,2})?$/.test(amount) || Number(amount) > 100_000_000)) return null;
  return amounts.reduce((total, amount) => total + Math.round(Number(amount) * 100), 0);
}
