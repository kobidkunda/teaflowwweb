import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructMetadata({
  title: "Track Your Tea Order",
  description: "Track shipment dispatch and delivery status from our Siliguri hub.",
  path: "/track",
  noindex: true,
});

export default function TrackLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
