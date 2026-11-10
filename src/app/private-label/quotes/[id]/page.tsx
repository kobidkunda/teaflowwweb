"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  CreditCard,
  Printer,
  RefreshCw,
  FileText,
  Clock,
  Sparkles,
} from "lucide-react";
import { ProofApprovalModal } from "@/components/private-label/ProofApprovalModal";

interface QuoteDetail {
  id: string;
  quote_number: string;
  project_id: string;
  status: string;
  version: number;
  currency: string;
  tea_subtotal_paise: number;
  packaging_subtotal_paise: number;
  printing_subtotal_paise: number;
  tooling_setup_paise: number;
  labor_subtotal_paise: number;
  qc_subtotal_paise: number;
  freight_paise: number;
  margin_paise: number;
  tax_paise: number;
  grand_total_paise: number;
  valid_until: string;
  revision: number;
  items?: Array<{
    id: string;
    description: string;
    quantity: number;
    unit_price_paise: number;
    line_total_paise: number;
  }>;
}

export default function InteractiveQuotePage(props: { params: Promise<{ id: string }> }) {
  const { id } = use(props.params);
  const router = useRouter();

  const [quote, setQuote] = useState<QuoteDetail | null>(null);
  const [proofApproved, setProofApproved] = useState(false);
  const [proofReady, setProofReady] = useState(false);
  const [activeProofRevision, setActiveProofRevision] = useState<number | null>(null);
  const [proofPreviewUrl, setProofPreviewUrl] = useState<string | null>(null);
  const [activeProofId, setActiveProofId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checkingOut, setCheckingOut] = useState(false);
  const [approvingProof, setApprovingProof] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadQuote() {
      try {
        setLoading(true);
        const res = await fetch(`/api/v1/private-label/quotes/${id}`);
        if (!res.ok) {
          setError("Quote not found or session expired.");
          return;
        }
        const data = await res.json();
        const quoteObj = data.quote || data;
        setQuote(quoteObj);

        // Resolve linked project ID
        const resolvedProjectId = data.project_id || data.quote?.project_id || quoteObj.project_id;

        if (resolvedProjectId) {
          const proofRes = await fetch(`/api/v1/private-label/projects/${resolvedProjectId}/proofs/current`);
          if (proofRes.ok) {
            const proofData = await proofRes.json();
            if (proofData.proof?.id) {
              setActiveProofId(proofData.proof.id);
              setActiveProofRevision(proofData.proof.revision);
              setProofReady(proofData.proof.status === "preflight_passed");
              setProofPreviewUrl(proofData.proof.print_ready_pdf_url || proofData.proof.preview_render_url || proofData.proof.asset_url || null);
              if (proofData.status === "customer_approved" || proofData.proof?.status === "customer_approved") {
                setProofApproved(true);
              }
            }
          }
        }
      } catch {
        setError("Network error loading quote.");
      } finally {
        setLoading(false);
      }
    }

    loadQuote();
  }, [id]);

  const isExpired = quote ? new Date(quote.valid_until).getTime() < Date.now() : false;
  const depositPaise = quote ? Math.round(quote.grand_total_paise * 0.5) : 0;
  const balancePaise = quote ? quote.grand_total_paise - depositPaise : 0;
  const formatPaise = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

  async function handleCheckout() {
    if (!quote || isExpired || !proofApproved) return;

    try {
      setCheckingOut(true);
      setError(null);

      const res = await fetch("/api/v1/private-label/orders/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: quote.id,
          idempotency_key: `private-label-order-${quote.id}-${quote.revision}`,
          expected_revision: quote.revision,
          gateway_currency: quote.currency || "INR",
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Order conversion failed.");
        return;
      }

      const orderId = data.order_id || data.order?.id;
      if (orderId) {
        router.push(`/private-label/orders/${orderId}`);
      } else {
        router.push("/account/private-label");
      }
    } catch {
      setError("Network error processing order conversion.");
    } finally {
      setCheckingOut(false);
    }
  }

  async function handleProofSignOff(data: { disclaimerAccepted: boolean; comments?: string; signerName?: string }) {
    if (approvingProof || !proofReady || !data.disclaimerAccepted || !data.signerName?.trim() || !activeProofRevision) return;

    try {
      setApprovingProof(true);
      setError(null);

      const targetProofId = activeProofId;

      if (!targetProofId) {
        setError("Unable to resolve digital proof for this quotation. Please verify your design.");
        return;
      }

      const res = await fetch(`/api/v1/private-label/proofs/${targetProofId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          disclaimer_accepted: true,
          legal_disclaimer_accepted: true,
          signer_name: data.signerName.trim(),
          expected_revision: activeProofRevision,
          notes: data.comments || undefined,
        }),
      });

      const resData = await res.json();
      if (!res.ok) {
        setError(resData.error || "Digital proof approval failed.");
        return;
      }

      setProofApproved(true);
      setIsModalOpen(false);
    } catch {
      setError("Network error approving digital proof.");
    } finally {
      setApprovingProof(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] py-16 px-4">
        <div className="max-w-4xl mx-auto flex flex-col items-center justify-center py-20 text-[#65746D]">
          <RefreshCw className="w-8 h-8 animate-spin text-[#143C31] mb-3" />
          <p className="text-sm">Calculating quotation breakdown...</p>
        </div>
      </div>
    );
  }

  if (error || !quote) {
    return (
      <div className="min-h-screen bg-[#FBF9F4] py-16 px-4">
        <div className="max-w-xl mx-auto bg-white border border-[#E8E4DC] rounded-2xl p-8 text-center shadow-xs">
          <FileText className="w-12 h-12 text-[#65746D] mx-auto mb-4" />
          <h1 className="text-xl font-serif font-bold text-[#143C31] mb-2">Quote Notice</h1>
          <p className="text-xs text-[#65746D] mb-6">{error || "Quotation could not be located."}</p>
          <Link
            href="/account/private-label"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-semibold bg-[#143C31] text-white"
          >
            <ArrowLeft size={14} /> Back to Hub
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="quote-checkout-container"
      className="min-h-screen bg-[#FBF9F4] py-12 px-4"
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E8E4DC]">
          <div>
            <Link
              href="/account/private-label"
              className="inline-flex items-center gap-1.5 text-xs text-[#65746D] hover:text-[#143C31] mb-2"
            >
              <ArrowLeft size={14} /> Back to Private Label Hub
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl md:text-3xl font-serif font-bold text-[#143C31]">
                Commercial Quotation {quote.quote_number}
              </h1>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full uppercase bg-[#EBF3EF] text-[#143C31] border border-[#C5D6CC]">
                {quote.status}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href={`/private-label/quotes/${quote.id}/print`}
              target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white border border-[#DDE4DC] text-[#143C31] hover:bg-[#F3EFE6] transition-colors shadow-2xs"
            >
              <Printer size={14} /> Branded PDF Print
            </Link>
          </div>
        </div>

        {/* Expiration Banner */}
        {isExpired ? (
          <div className="bg-rose-50 border border-rose-200 text-rose-800 rounded-xl p-4 flex items-center gap-3 text-xs">
            <AlertTriangle className="w-5 h-5 shrink-0 text-rose-600" />
            <div>
              <p className="font-bold">Quotation Expired</p>
              <p className="text-rose-700">
                This quote expired on {new Date(quote.valid_until).toLocaleDateString("en-IN")}. Price books update regularly. Please request a refreshed quote from the configurator.
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-[#EBF3EF] border border-[#C5D6CC] text-[#143C31] rounded-xl p-4 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Clock size={16} />
              <span>
                {quote.status === "estimated" ? "Estimate for review through " : "Quotation valid through "}
                <span className="font-bold">
                  {new Date(quote.valid_until).toLocaleDateString("en-IN", { dateStyle: "long" })}
                </span>
              </span>
            </div>
          </div>
        )}

        <section aria-label="Configured order items" className="bg-white border border-[#E8E4DC] rounded-xl p-5 space-y-3">
          <h2 className="font-serif text-lg">Your Configuration</h2>
          {(quote.items || []).map(item => <article key={item.id} className="border-b border-[#E8E4DC] pb-3"><h3 className="font-medium">{item.description}</h3><p className="text-sm text-[#65746D]">{item.quantity.toLocaleString("en-IN")} units · {formatPaise(item.unit_price_paise)} per unit</p></article>)}
          {quote.status === "estimated" && <p className="text-sm text-[#65746D]">This is an estimate. Our team must confirm specifications, rates and production readiness. No payment has been collected.</p>}
        </section>
        {/* Proof Prerequisite Banner */}
        <div
          data-testid="proof-status-indicator"
          className={`border rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 ${
            proofApproved
              ? "bg-[#EBF3EF] border-[#C5D6CC] text-[#143C31]"
              : "bg-amber-50 border-amber-200 text-amber-900"
          }`}
        >
          <div className="flex items-start gap-3">
            {proofApproved ? (
              <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="text-sm font-bold">
                {proofApproved
                  ? "Artwork Design Proof Approved & Production Locked"
                  : "Production Prerequisite: Design Proof Approval Required"}
              </p>
              <p className="text-xs mt-0.5 opacity-90">
                {proofApproved
                  ? "Your production proof approval has been recorded."
                  : "A production proof must be prepared and reviewed before approval. Contact our team if your proof is not yet available."}
              </p>
            </div>
          </div>

          {!proofApproved && (
            <button
              type="button"
              disabled={!activeProofId || !proofReady || approvingProof}
              onClick={() => setIsModalOpen(true)}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#143C31] text-white hover:bg-[#1E5244] transition-colors shrink-0 shadow-2xs disabled:opacity-50"
            >
              {approvingProof ? "Signing Proof..." : "Review & Sign Proof"}
            </button>
          )}
        </div>

        {/* 12-Component Itemized Price Breakdown */}
        <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-serif font-bold text-[#143C31] pb-2 border-b border-[#E8E4DC]">
            Itemized Cost Schedule
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs divide-y md:divide-y-0 divide-[#E8E4DC]">
            <div className="flex justify-between py-1.5">
              <span className="text-[#65746D]">Estate Tea Leaf Batch</span>
              <span className="font-semibold text-[#143C31]">{formatPaise(quote.tea_subtotal_paise)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#65746D]">Packaging Substrate Units</span>
              <span className="font-semibold text-[#143C31]">{formatPaise(quote.packaging_subtotal_paise)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#65746D]">Printing &amp; Custom Labeling</span>
              <span className="font-semibold text-[#143C31]">{formatPaise(quote.printing_subtotal_paise)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#65746D]">Tooling &amp; Cylinder Setup</span>
              <span className="font-semibold text-[#143C31]">{formatPaise(quote.tooling_setup_paise)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#65746D]">Packing &amp; Requested Finishing</span>
              <span className="font-semibold text-[#143C31]">{formatPaise(quote.labor_subtotal_paise)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#65746D]">Quality Review</span>
              <span className="font-semibold text-[#143C31]">{formatPaise(quote.qc_subtotal_paise)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#65746D]">Freight & Logistics</span>
              <span className="font-semibold text-[#143C31]">{formatPaise(quote.freight_paise)}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-[#65746D]">GST &amp; Statutory Taxes</span>
              <span className="font-semibold text-[#143C31]">{formatPaise(quote.tax_paise)}</span>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E8E4DC] flex justify-between items-center text-sm font-bold text-[#143C31]">
            <span>Contract Grand Total</span>
            <span className="text-xl font-serif">{formatPaise(quote.grand_total_paise)}</span>
          </div>
        </div>

        {/* 50% Advance Checkout Action */}
        <div className="bg-white border border-[#E8E4DC] rounded-xl p-6 shadow-2xs space-y-4">
          <h2 className="text-base font-serif font-bold text-[#143C31] pb-2 border-b border-[#E8E4DC] flex items-center gap-2">
            <CreditCard size={18} /> Production Release Authorization
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div className="p-4 bg-[#FBF9F4] border border-[#E8E4DC] rounded-lg">
              <span className="text-[#65746D] block">Proposed Advance Deposit (50%)</span>
              <span className="text-lg font-serif font-bold text-[#143C31] mt-1 block">
                {formatPaise(depositPaise)}
              </span>
              <p className="text-[11px] text-[#65746D] mt-1">
                Payment arrangements and production readiness must be confirmed with our team.
              </p>
            </div>

            <div className="p-4 bg-[#FBF9F4] border border-[#E8E4DC] rounded-lg">
              <span className="text-[#65746D] block">Payable on Final QC Pass (50% Balance)</span>
              <span className="text-lg font-serif font-bold text-[#143C31] mt-1 block">
                {formatPaise(balancePaise)}
              </span>
              <p className="text-[11px] text-[#65746D] mt-1">
                Due upon completion of 7/7 QC milestones prior to consignment dispatch.
              </p>
            </div>
          </div>

          <div className="pt-2 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#65746D]">
              Creating an order request does not collect payment or release production.
            </p>

            <button
              type="button"
              data-testid="deposit-pay-button"
              disabled={isExpired || !proofApproved || checkingOut}
              onClick={handleCheckout}
              className="w-full md:w-auto px-8 py-3.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#143C31] text-white hover:bg-[#1E5244] transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {checkingOut ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Creating Order Request...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Create Order Request
                </>
              )}
            </button>
          </div>
        </div>

        {/* Proof Approval Modal Trigger */}
        <ProofApprovalModal
          proofPreviewUrl={proofPreviewUrl}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onApprove={handleProofSignOff}
        />
      </div>
    </div>
  );
}
