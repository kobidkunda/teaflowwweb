import React from "react";
import { getStoreSettings } from "@/lib/storeSettings";
import { PrivateLabelWhatsAppHelp } from "@/components/private-label/shared/PrivateLabelWhatsAppHelp";

export const dynamic = "force-dynamic";

export default function PrivateLabelRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let whatsappNumber = "+91 7001304853";
  let storeName = "TeaFloww";

  try {
    const settings = getStoreSettings();
    if (settings?.whatsapp_number?.trim()) {
      whatsappNumber = settings.whatsapp_number.trim();
    }
    if (settings?.store_name?.trim()) {
      storeName = settings.store_name.trim();
    }
  } catch {
    // Graceful fallback to default brand constants
  }

  return (
    <>
      {children}
      <PrivateLabelWhatsAppHelp
        whatsappNumber={whatsappNumber}
        storeName={storeName}
      />
    </>
  );
}
