declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => {
      open(): void;
      on(event: string, callback: () => void): void;
    };
  }
}

let checkoutScript: Promise<void> | null = null;
export function loadCheckout() {
  if (window.Razorpay) return Promise.resolve();
  if (!checkoutScript) {
    checkoutScript = new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve();
      script.onerror = () => {
        checkoutScript = null;
        script.remove();
        reject(new Error("Payment screen could not load. Please verify your connection and retry."));
      };
      document.head.append(script);
    });
  }
  return checkoutScript;
}

