export type AnimationDevice = {
  deviceMemory?: number;
  hardwareConcurrency?: number;
  connection?: { saveData?: boolean; effectiveType?: string; downlink?: number };
};

// Missing capability signals deliberately retain the lightweight still image.
export function canAnimateTradeHero(device: AnimationDevice, reducedMotion: boolean) {
  return !reducedMotion && (device.deviceMemory ?? 0) >= 4 &&
    (device.hardwareConcurrency ?? 0) >= 4 &&
    device.connection?.saveData !== true &&
    device.connection?.effectiveType === "4g" &&
    (device.connection?.downlink ?? 0) >= 5;
}
