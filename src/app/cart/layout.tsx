import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructMetadata({
  title: "Shopping Cart",
  description: "Review your selected whole-leaf orthodox teas and proceed to secure checkout.",
  path: "/cart",
  noindex: true,
});

export default function CartLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
