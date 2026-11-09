import Link from "next/link";
import { ResetClient } from "@/components/admin/ResetClient";
export const metadata = { title: "Admin · Password reset" };
export default async function AdminResetPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return <div className="container page-shell" style={{ maxWidth: 560 }}>
    <p className="eyebrow">Store administration</p>
    <h1>Password reset</h1>
    <p className="page-intro">Reset links are single-use and expire after 60 minutes. <Link href="/admin" className="text-link">Back to sign-in</Link>.</p>
    <ResetClient initialToken={typeof token === "string" ? token.slice(0, 200) : ""} />
  </div>;
}
