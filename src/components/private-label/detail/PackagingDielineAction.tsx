import React from "react";
import Link from "next/link";
import styles from "../styles/PrivateLabel.module.css";
import { Download, FileText } from "lucide-react";

export function PackagingDielineAction({ dielineUrl, variantTitle }: { dielineUrl?: string | null; variantTitle: string }) {
  const approvedUrl = dielineUrl && (/^\/(?!\/)/.test(dielineUrl) || /^https:\/\//.test(dielineUrl)) ? dielineUrl : null;
  const className = styles.secondaryCta;
  const style: React.CSSProperties = { display: "inline-flex", alignItems: "center", gap: 8, color: "#143C31", borderColor: "#143C31", minHeight: 44, padding: "8px 12px", maxWidth: "100%", boxSizing: "border-box" };
  if (approvedUrl) return <a href={approvedUrl} download data-testid="download-dieline" className={className} style={style}><Download size={18} aria-hidden="true" />Download Approved Dieline</a>;
  return <Link href={`/private-label?dieline=${encodeURIComponent(variantTitle.slice(0, 200))}#sample-kit`} data-testid="download-dieline" className={className} style={style}><FileText size={18} aria-hidden="true" />Request Prepress Dieline</Link>;
}
