import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructMetadata({
  title: "Private Label Quote",
  description: "Bespoke tea production and packaging estimate.",
  path: "/private-label/quotes",
  noindex: true,
});

export default function PrivateLabelQuotesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
