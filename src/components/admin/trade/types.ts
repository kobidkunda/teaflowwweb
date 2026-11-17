import { useRef } from "react";

export type TabId =
  | "settings"
  | "offers"
  | "lanes"
  | "content"
  | "enquiries"
  | "orders"
  | "pilots";

export type TradeSettingsState = {
  channel_enabled: boolean;
  enabled_locales: string[];
  staged_locales: string[];
  featured_trial_id: string | null;
  trial_parcel_rate_paise: number;
  trial_credit_paise: number;
  trial_credit_min_qty_kg: number;
  trial_credit_expiry_days: number;
  whatsapp_number: string;
  support_hours: string;
  dispatch_cutoff_label: string;
  hero_image_url: string;
  hero_video_url: string | null;
  hero_video_poster_url: string | null;
  trial_image_url: string;
};

export type TradeCatalogProduct = {
  id: number;
  slug: string;
  name: string;
  enabled: number;
};

export type TradeCatalogVariant = {
  id: number;
  product_id: number;
  sku: string;
  grams: number;
  price_paise: number;
  stock: number;
};

export type TradeCatalogTrial = {
  id: string;
  slug: string;
  title: string;
  status: string;
};

export type AdminTradePayload = {
  settings: TradeSettingsState;
  offers: Array<Record<string, unknown>>;
  lanes: Array<Record<string, unknown>>;
  enquiries: Array<Record<string, unknown>>;
  localizedContent: Array<Record<string, unknown>>;
  sharedPilots: Array<Record<string, unknown>>;
  orders: Array<Record<string, unknown>>;
  funnelSummary: {
    eventCounts: Array<{ event_name: string; count: number; total_paise: number }>;
    quoteStats: Array<{ kind: string; count: number }>;
    enquiryStats: Array<{ status: string; count: number }>;
  };
  catalog: {
    products: TradeCatalogProduct[];
    variants: TradeCatalogVariant[];
    trials: TradeCatalogTrial[];
  };
};

export type StatusToast = {
  kind: "ok" | "err";
  text: string;
};

export const TRADE_LOCALE_OPTIONS = [
  { code: "en", label: "English" },
  { code: "hi", label: "हिन्दी (Hindi)" },
  { code: "bn", label: "বাংলা (Bengali)" },
  { code: "gu", label: "ગુજરાતી (Gujarati)" },
  { code: "mr", label: "मराठी (Marathi)" },
  { code: "pa", label: "ਪੰਜਾਬੀ (Punjabi)" },
  { code: "ta", label: "தமிழ் (Tamil)" },
  { code: "te", label: "తెలుగు (Telugu)" },
  { code: "kn", label: "ಕನ್ನಡ (Kannada)" },
] as const;

export function formatRupees(paise: number | string | null | undefined): string {
  const num = Number(paise ?? 0);
  if (!Number.isFinite(num)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: num % 100 === 0 ? 0 : 2,
  }).format(num / 100);
}

export function formatDateTime(value: unknown): string {
  if (!value) return "—";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Polyfill helper for browsers lacking `<dialog closedby="any">`.
 * Requires both pointerdown and pointerup outside the dialog box so text-selection drags don't dismiss.
 */
export function useDialogLightDismiss(
  ref: React.RefObject<HTMLDialogElement | null>,
  onDismiss?: () => void
) {
  const pressedOutsideRef = useRef(false);
  const isOutside = (e: React.PointerEvent<HTMLDialogElement>, dlg: HTMLDialogElement) => {
    const r = dlg.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  return {
    onPointerDown: (e: React.PointerEvent<HTMLDialogElement>) => {
      if ("closedBy" in HTMLDialogElement.prototype) return;
      pressedOutsideRef.current = isOutside(e, e.currentTarget);
    },
    onPointerUp: (e: React.PointerEvent<HTMLDialogElement>) => {
      if ("closedBy" in HTMLDialogElement.prototype) return;
      if (pressedOutsideRef.current && isOutside(e, e.currentTarget)) {
        ref.current?.close();
        onDismiss?.();
      }
      pressedOutsideRef.current = false;
    },
  };
}
