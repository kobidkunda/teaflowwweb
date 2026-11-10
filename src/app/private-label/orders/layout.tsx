import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructMetadata({
  title: "Private Label Production Order",
  description: "Bespoke tea production, proofing, and packaging order tracking.",
  path: "/private-label/orders",
  noindex: true,
});

export default function PrivateLabelOrdersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
