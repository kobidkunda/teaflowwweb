import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = constructMetadata({
  title: "Customer Account",
  description: "Manage your TeaFloww orders, subscriptions, and shipping addresses.",
  path: "/account",
  noindex: true,
});

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
