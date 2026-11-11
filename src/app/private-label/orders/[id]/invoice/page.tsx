"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { use, useEffect, useState } from "react";
import Link from "next/link";

interface Invoice {
  order_number: string; currency: string; created_at: string;
  items: Array<{ id: string; description: string; quantity: number; unit_price_paise: number; line_total_paise: number }>;
  subtotal_paise: number; tax_paise: number; total_paise: number;
  deposit_paise: number; balance_paise: number; deposit_paid: boolean;
}

export default function CommercialSummary({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/private-label/orders/${encodeURIComponent(id)}/invoice`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error(response.status === 401 ? "Sign in to view this order document." : "This order document could not be loaded.");
        const data = await response.json();
        if (!controller.signal.aborted) setInvoice(data);
      }).catch(() => { if (!controller.signal.aborted) setError("Unable to load this order document. Sign in again or retry."); });
    return () => controller.abort();
  }, [id]);
  if (error) return <div role="alert" style={{ padding: 32 }}><p>{error}</p><Link href="/account/private-label"><StorefrontText id="copy_47d32925dd1fc80f" fallback="Return to your workspace" /></Link></div>;
  if (!invoice) return <p role="status" style={{ padding: 32 }}><StorefrontText id="copy_b1303feba18e8a40" fallback="Loading commercial summary…" /></p>;
  const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: invoice.currency }).format(paise / 100);
  return <article className="commercial-summary" style={{ maxWidth: 820, margin: "32px auto", padding: "24px 16px", background: "#fff", color: "#143C31" }}>
    <style>{`@media print { body * { visibility: hidden; } .commercial-summary, .commercial-summary * { visibility: visible; } .commercial-summary { position: absolute; inset: 0 auto auto 0; width: 100%; max-width: none !important; margin: 0 !important; padding: 0 !important; } header, footer, .commercial-no-print { display: none !important; } @page { margin: 15mm; } }`}</style>
    <div className="commercial-no-print" style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 24 }}>
      <Link href={`/private-label/orders/${encodeURIComponent(id)}`}><StorefrontText id="copy_5df23644c62d8d4d" fallback="← Return to order" /></Link>
      <button type="button" onClick={() => window.print()} style={{ minHeight: 44, padding: "8px 16px", border: "1px solid #143C31" }}><StorefrontText id="copy_bf7850226454a4d0" fallback="Print / Save PDF" /></button>
    </div>
    <p><StorefrontText id="copy_3cbca7573fa03259" fallback="TeaFloww · Nirva · GSTIN 19CTHPK8646J2ZY" /></p>
    <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(24px, 4vw, 36px)" }}><StorefrontText id="copy_2234f630556e063b" fallback="Commercial Order Summary" /></h1>
    <p><StorefrontText id="copy_6be090825c997103" fallback="Order" /> {invoice.order_number}</p>
    <p>{new Date(invoice.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
    <section aria-label="Order items" style={{ margin: "24px 0" }}>
      {(invoice.items || []).map(item => <div key={item.id} style={{ padding: "16px 0", borderBottom: "1px solid #DDE4DC" }}>
        <h2 style={{ fontSize: 18 }}>{item.description}</h2>
        <p>{item.quantity.toLocaleString("en-IN")}<StorefrontText id="copy_a519f1024cf3fa5c" fallback="units ·" /> {money(item.unit_price_paise)}<StorefrontText id="copy_7a3f3bea5f9c85db" fallback="per unit" /></p>
        <p><StorefrontText id="copy_3e83ef89fad0ba2e" fallback="Line total, including quoted tax:" /> <strong>{money(item.line_total_paise)}</strong></p>
      </div>)}
    </section>
    <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px 16px" }}>
      <dt><StorefrontText id="copy_d290fa3274f5c6bc" fallback="Subtotal before GST" /></dt><dd>{money(invoice.subtotal_paise)}</dd>
      <dt><StorefrontText id="copy_057af800bd45426b" fallback="GST from quotation" /></dt><dd>{money(invoice.tax_paise)}</dd>
      <dt><StorefrontText id="copy_c9b3c38247f744e1" fallback="Total" /></dt><dd><strong>{money(invoice.total_paise)}</strong></dd>
      <dt><StorefrontText id="copy_ec62e62819ee9478" fallback="Advance deposit" /></dt><dd>{money(invoice.deposit_paise)}</dd>
      <dt><StorefrontText id="copy_d05e07b7c14e596a" fallback="Balance" /></dt><dd>{money(invoice.balance_paise)}</dd>
    </dl>
    <p role="status" style={{ marginTop: 24 }}><StorefrontText id="copy_733024784e728894" fallback="Payment status:" /> {invoice.deposit_paid ? "Deposit payment recorded" : "Awaiting verified payment"}.</p>
    <p><StorefrontText id="copy_eea3e9d82c1407da" fallback="This summary records the order and quoted amounts. Our team confirms the final tax invoice and payment arrangements." /></p>
  </article>;
}
