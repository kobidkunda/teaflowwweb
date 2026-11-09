"use client";
import React, { useEffect, useState, useRef } from "react";
import type { LiveOrder } from "@/lib/international/orders";
import type { Quote } from "@/lib/international/models";
import { formatMoney } from "@/lib/international/money";
import { adminRequest, useOperation, Field } from "./shared";
import { generateUUID } from "@/lib/uuid";
type Job = { id: string; kind: string; status: string; attempts: number; error: string | null };
export function FulfillmentAdmin() {
  const [orders, setOrders] = useState<LiveOrder[]>([]), [jobs, setJobs] = useState<Job[]>([]), [edit, setEdit] = useState<LiveOrder | null>(null), [amount, setAmount] = useState(""), [reference, setReference] = useState("");
  const refundKey = useRef<{ fingerprint: string; key: string } | null>(null);
  const op = useOperation();
  async function refresh() { const [o, j] = await Promise.all([adminRequest("orders"), adminRequest("jobs")]); setOrders(o.orders); setJobs(j.jobs); }
  useEffect(() => { refresh().catch(e => op.setMessage(e.message)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  function action(kind: string) { if (!edit) return;
    const fingerprint = `${edit.id}:${amount}`;
    if (kind === "refund" && refundKey.current?.fingerprint !== fingerprint) refundKey.current = { fingerprint, key: generateUUID() };
    op.run(async () => { await adminRequest("fulfillment", { orderId: edit.id, action: kind, ...(amount ? { amount: Number(amount) } : {}), ...(reference ? { reference } : {}), ...(kind === "refund" ? { key: refundKey.current!.key } : {}) }); await refresh(); }); }
  return <div className="tf-ops"><p className="eyebrow">OPERATIONS</p><h1>Orders & fulfillment</h1><p>Approve shipment booking after reviewing payment, destination, and package details. COD remains unpaid until remittance is verified.</p><p role="status">{op.message}</p>
    <section className="tf-ops-card"><h2>International commerce orders</h2><button disabled={op.busy} onClick={() => op.run(refresh)}>Refresh</button>{!orders.length ? <p>No live-commerce orders yet. Legacy demo orders remain in the existing Orders page.</p> : <div className="tf-ops-table"><table><thead><tr><th>Order</th><th>Country</th><th>Total</th><th>Payment</th><th>Inventory / fulfillment</th><th>Actions</th></tr></thead><tbody>{orders.map(o => { const q = JSON.parse(o.document) as Quote; return <tr key={o.id}><td>{o.id.slice(0, 8)}</td><td>{q.input.address.country}</td><td>{formatMoney(q.totalMinor, q.currency)}</td><td>{o.payment_status}</td><td>{o.inventory_status} / {o.fulfillment_status}</td><td><button onClick={() => { setEdit(o); setAmount(""); setReference(""); }}>Review</button></td></tr>; })}</tbody></table></div>}</section>
    {edit && <section className="tf-ops-card"><h2>Order {edit.id}</h2><p>{edit.payment_status} · {edit.fulfillment_status}</p><address>{(() => { const q = JSON.parse(edit.document) as Quote; return `${q.input.address.name} · ${q.input.address.line1}, ${q.input.address.city}, ${q.input.address.postcode}, ${q.input.address.country}`; })()}</address><div className="tf-ops-actions">{["book", "awb", "label", "pickup", "track", "cancel"].map(k => <button disabled={op.busy} key={k} onClick={() => action(k)}>{k}</button>)}</div><div className="tf-market-pair"><Field label="Amount in original currency minor units" value={amount} type="number" set={setAmount} /><Field label="Gateway order ID or COD remittance reference" value={reference} set={setReference} /></div><div className="tf-ops-actions"><button disabled={op.busy} onClick={() => action("reconcile")}>Link verified gateway order</button><button disabled={op.busy} onClick={() => action("cod")}>Record verified COD remittance</button><button disabled={op.busy} onClick={() => action("refund")}>Request refund</button><button onClick={() => setEdit(null)}>Close</button></div><p>Refunds keep the original currency. Returned stock requires physical inspection; refunds never restock automatically.</p></section>}
    <section className="tf-ops-card"><h2>Background work</h2><div className="tf-ops-table"><table><thead><tr><th>Job</th><th>Status</th><th>Attempts</th><th>Details</th><th>Action</th></tr></thead><tbody>{jobs.map(j => <tr key={j.id}><td>{j.kind}</td><td>{j.status}</td><td>{j.attempts}</td><td>{j.error}</td><td>{j.status === "failed" && <button disabled={op.busy} onClick={() => op.run(async () => { await adminRequest("retry", { id: j.id }); await refresh(); })}>Retry safe job</button>}</td></tr>)}</tbody></table></div></section>
  </div>;
}
