"use client";

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
  if (error) return <div role="alert" style={{ padding: 32 }}><p>{error}</p><Link href="/account/private-label">Return to your workspace</Link></div>;
  if (!invoice) return <p role="status" style={{ padding: 32 }}>Loading commercial summary…</p>;
  const money = (paise: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: invoice.currency }).format(paise / 100);
  return <article style={{ maxWidth: 820, margin: "32px auto", padding: "24px 16px", background: "#fff", color: "#143C31" }}>
    <style>{`@media print { header, footer, .commercial-no-print { display: none !important; } @page { margin: 15mm; } }`}</style>
    <div className="commercial-no-print" style={{ display: "flex", flexWrap: "wrap", gap: 20, marginBottom: 24 }}>
      <Link href={`/private-label/orders/${encodeURIComponent(id)}`}>← Return to order</Link>
      <button type="button" onClick={() => window.print()} style={{ minHeight: 44, padding: "8px 16px", border: "1px solid #143C31" }}>Print / Save PDF</button>
    </div>
    <p>TeaFloww · Nirva · GSTIN 19CTHPK8646J2ZY</p>
    <h1 style={{ fontFamily: "Georgia, serif", fontSize: "clamp(24px, 4vw, 36px)" }}>Commercial Order Summary</h1>
    <p>Order {invoice.order_number}</p>
    <p>{new Date(invoice.created_at).toLocaleDateString("en-IN", { dateStyle: "long" })}</p>
    <section aria-label="Order items" style={{ margin: "24px 0" }}>
      {(invoice.items || []).map(item => <div key={item.id} style={{ padding: "16px 0", borderBottom: "1px solid #DDE4DC" }}>
        <h2 style={{ fontSize: 18 }}>{item.description}</h2>
        <p>{item.quantity.toLocaleString("en-IN")} units · {money(item.unit_price_paise)} per unit</p>
        <p>Line total, including quoted tax: <strong>{money(item.line_total_paise)}</strong></p>
      </div>)}
    </section>
    <dl style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "12px 16px" }}>
      <dt>Subtotal before GST</dt><dd>{money(invoice.subtotal_paise)}</dd>
      <dt>GST from quotation</dt><dd>{money(invoice.tax_paise)}</dd>
      <dt>Total</dt><dd><strong>{money(invoice.total_paise)}</strong></dd>
      <dt>Advance deposit</dt><dd>{money(invoice.deposit_paise)}</dd>
      <dt>Balance</dt><dd>{money(invoice.balance_paise)}</dd>
    </dl>
    <p role="status" style={{ marginTop: 24 }}>Payment status: {invoice.deposit_paid ? "Deposit payment recorded" : "Awaiting verified payment"}.</p>
    <p>This summary records the order and quoted amounts. Our team confirms the final tax invoice and payment arrangements.</p>
  </article>;
}
