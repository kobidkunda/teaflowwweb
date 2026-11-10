import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructMetadata({
  title: "Order Samples & Substrate Swatches — Private Label | TeaFloww",
  description: "Order tactile packaging swatches, single-estate tasting flights, or pre-production custom printed proofs.",
  path: "/private-label/samples",
});

export default function SamplesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
