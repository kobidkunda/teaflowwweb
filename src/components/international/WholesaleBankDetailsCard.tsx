"use client";

import React, { useState } from "react";
import { Building2, Copy, Check, MessageSquare, ShieldCheck, ArrowRight } from "lucide-react";
import { formatMoney } from "@/lib/international/money";

export type WholesaleBankDetailsProps = {
  beneficiary: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  branch: string;
  upiId?: string;
  orderReference: string;
  totalMinor: number;
  advanceMinor?: number;
  balanceMinor?: number;
  currency: string;
  paymentStatus: string;
  advancePercent?: number;
  whatsappNumber?: string;
  locale?: string;
};

export function WholesaleBankDetailsCard(props: WholesaleBankDetailsProps) {
  const [copied, setCopied] = useState(false);

  const amountToTransferMinor =
    props.paymentStatus === "advance_paid" && props.balanceMinor !== undefined
      ? props.balanceMinor
      : props.totalMinor;

  const formattedTransferAmount = formatMoney(amountToTransferMinor, props.currency, props.locale || "en");
  const formattedTotalAmount = formatMoney(props.totalMinor, props.currency, props.locale || "en");
  const formattedAdvanceAmount = props.advanceMinor ? formatMoney(props.advanceMinor, props.currency, props.locale || "en") : "";

  const copyText = `TeaFloww Wholesale Bank Transfer Details:
Beneficiary Name: ${props.beneficiary || "Nirva"}
Bank Name: ${props.bankName || "HDFC Bank"}
Account Number: ${props.accountNumber || "—"}
IFSC Code: ${props.ifsc || "—"}
Branch: ${props.branch || "Siliguri"}
${props.upiId ? `UPI ID: ${props.upiId}\n` : ""}Amount to Transfer: ${formattedTransferAmount}
Transfer Remark / Reference: TF-${props.orderReference}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const rawPhone = (props.whatsappNumber || "+917001304853").replace(/[^\d]/g, "");
  const whatsappUrl = `https://wa.me/${rawPhone}?text=${encodeURIComponent(
    `Hello TeaFloww, I have initiated the bank transfer of ${formattedTransferAmount} for wholesale order TF-${props.orderReference}. Please verify and schedule dispatch.`
  )}`;

  return (
    <section
      className="p-6 sm:p-7 rounded-2xl border-2 border-[#23483a]/20 bg-[#faf8f4] shadow-sm space-y-5"
      aria-label="Direct bank transfer instructions"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#ded7cb]">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-[#e8f0eb] text-[#23483a] flex items-center justify-center flex-shrink-0">
            <Building2 size={20} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-serif font-bold text-[#171713]">
              Direct A/C Transfer Details
            </h2>
            <p className="text-xs text-[#5c6659]">
              Settlement required prior to commercial road transport dispatch
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-[#ded7cb] text-[#171713] hover:bg-[#f2eee6] transition-colors shadow-xs"
        >
          {copied ? (
            <>
              <Check size={14} className="text-[#2e7d32]" />
              <span className="text-[#2e7d32]">Copied to Clipboard!</span>
            </>
          ) : (
            <>
              <Copy size={14} />
              <span>Copy Bank Details</span>
            </>
          )}
        </button>
      </div>

      {/* Status Notice Banner */}
      {props.paymentStatus === "advance_paid" ? (
        <div className="p-3.5 rounded-xl bg-[#eaf4ed] border border-[#c2e0cb] text-xs text-[#1e4620]">
          <strong className="block font-semibold text-sm mb-0.5">
            ✓ Advance Payment Received ({props.advancePercent}% via PG: {formattedAdvanceAmount})
          </strong>
          <span>
            Your wholesale inventory has been locked. Please transfer the remaining balance of{" "}
            <strong>{formattedTransferAmount}</strong> to complete clearance before surface transport dispatch.
          </span>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-[#fff9ed] border border-[#eedab2] text-xs text-[#7d5615]">
          <strong className="block font-semibold text-sm mb-0.5">
            📦 Direct Account Transfer (100% Payable Before Dispatch)
          </strong>
          <span>
            Online payment skipped. Please transfer <strong>{formattedTransferAmount}</strong> using NEFT, RTGS, IMPS, or corporate UPI. Commercial road transport LR/Bilty details will be issued upon clearance.
          </span>
        </div>
      )}

      {/* Account Specs Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
        <div className="p-3 rounded-xl bg-white border border-[#ded7cb]">
          <span className="block text-[11px] uppercase tracking-wider text-[#737067] font-semibold mb-0.5">
            Beneficiary / Account Name
          </span>
          <strong className="text-sm font-semibold text-[#171713]">
            {props.beneficiary || "Nirva"}
          </strong>
        </div>

        <div className="p-3 rounded-xl bg-white border border-[#ded7cb]">
          <span className="block text-[11px] uppercase tracking-wider text-[#737067] font-semibold mb-0.5">
            Bank Name
          </span>
          <strong className="text-sm font-semibold text-[#171713]">
            {props.bankName || "HDFC Bank"}
          </strong>
        </div>

        <div className="p-3 rounded-xl bg-white border border-[#ded7cb]">
          <span className="block text-[11px] uppercase tracking-wider text-[#737067] font-semibold mb-0.5">
            Account Number
          </span>
          <strong className="text-sm font-mono font-bold text-[#23483a] select-all">
            {props.accountNumber || "Contact Concierge"}
          </strong>
        </div>

        <div className="p-3 rounded-xl bg-white border border-[#ded7cb]">
          <span className="block text-[11px] uppercase tracking-wider text-[#737067] font-semibold mb-0.5">
            IFSC Code
          </span>
          <strong className="text-sm font-mono font-bold text-[#171713] select-all">
            {props.ifsc || "Contact Concierge"}
          </strong>
        </div>

        <div className="p-3 rounded-xl bg-white border border-[#ded7cb]">
          <span className="block text-[11px] uppercase tracking-wider text-[#737067] font-semibold mb-0.5">
            Branch / Origin Hub
          </span>
          <strong className="text-sm text-[#171713]">
            {props.branch || "Siliguri Branch"}
          </strong>
        </div>

        <div className="p-3 rounded-xl bg-white border border-[#ded7cb]">
          <span className="block text-[11px] uppercase tracking-wider text-[#737067] font-semibold mb-0.5">
            Payment Remark / Reference
          </span>
          <strong className="text-sm font-mono font-bold text-[#854d0e] select-all">
            TF-{props.orderReference}
          </strong>
        </div>

        {props.upiId && (
          <div className="sm:col-span-2 p-3 rounded-xl bg-white border border-[#ded7cb]">
            <span className="block text-[11px] uppercase tracking-wider text-[#737067] font-semibold mb-0.5">
              Corporate UPI ID
            </span>
            <strong className="text-sm font-mono font-bold text-[#23483a] select-all">
              {props.upiId}
            </strong>
          </div>
        )}
      </div>

      {/* Action Row */}
      <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2.5 px-4 rounded-xl bg-[#2e7d32] hover:bg-[#256629] text-white font-semibold text-xs text-center flex items-center justify-center gap-2 transition-colors shadow-xs"
        >
          <MessageSquare size={15} />
          <span>Share Transfer Screenshot / UTR on WhatsApp</span>
          <ArrowRight size={14} />
        </a>

        <div className="text-[11px] text-[#737067] flex items-center gap-1.5 px-2">
          <ShieldCheck size={14} className="text-[#23483a] flex-shrink-0" />
          <span>Verified GST &amp; Garden Origin Invoices</span>
        </div>
      </div>
    </section>
  );
}
