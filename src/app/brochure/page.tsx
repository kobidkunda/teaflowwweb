import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  Download,
  FileText,
  ShieldCheck,
  Package,
  Truck,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Coffee,
} from "lucide-react";
import { getBrochureSettings } from "@/lib/brochure";
import { constructMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const settings = getBrochureSettings();
  return constructMetadata({
    title: `${settings.title} | TeaFloww`,
    description:
      settings.description ||
      "Download our official single-estate orthodox tea brochure, harvest portfolio, wholesale specifications, and direct-from-origin procurement guide.",
    path: "/brochure",
  });
}

export default function BrochurePage() {
  const settings = getBrochureSettings();
  const isAvailable = settings.enabled && Boolean(settings.url) && settings.file_exists;

  return (
    <div className="tf-brochure-page" style={{ background: "var(--paper, #faf8f5)", minHeight: "100vh" }}>
      {/* Hero Header */}
      <section
        style={{
          background: "linear-gradient(135deg, #142318 0%, #1c3624 60%, #15271a 100%)",
          color: "#f6f1e7",
          padding: "70px 20px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxWidth: "960px",
            margin: "0 auto",
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              background: "rgba(214, 200, 167, 0.15)",
              border: "1px solid rgba(214, 200, 167, 0.3)",
              padding: "6px 16px",
              borderRadius: "50px",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#d6c8a7",
              marginBottom: "20px",
            }}
          >
            <Sparkles size={14} color="#d6c8a7" /> Single-Estate &amp; Wholesale Portfolio
          </div>

          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(32px, 4.5vw, 52px)",
              fontWeight: 400,
              lineHeight: 1.15,
              margin: "0 0 20px 0",
              letterSpacing: "-0.02em",
              color: "#ffffff",
            }}
          >
            {settings.title}
          </h1>

          <p
            style={{
              fontSize: "17px",
              lineHeight: 1.6,
              color: "#d3dbce",
              maxWidth: "680px",
              margin: "0 auto 36px",
            }}
          >
            {settings.description}
          </p>

          {isAvailable ? (
            <div
              style={{
                display: "inline-flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "14px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "center",
                  flexWrap: "wrap",
                }}
              >
                <a
                  href="/api/brochure/download"
                  download
                  className="button"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "10px",
                    background: "#c5a059",
                    color: "#18231c",
                    padding: "16px 36px",
                    borderRadius: "8px",
                    fontSize: "16px",
                    fontWeight: 700,
                    textDecoration: "none",
                    boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
                    transition: "transform 0.15s ease, background-color 0.15s ease",
                  }}
                  id="primary-download-brochure-btn"
                >
                  <Download size={20} />
                  <span>{settings.button_label || "Download Brochure"}</span>
                </a>

                <a
                  href="/api/brochure/download?view=1"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "rgba(255,255,255,0.12)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    color: "#ffffff",
                    padding: "16px 24px",
                    borderRadius: "8px",
                    fontSize: "15px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  <ExternalLink size={18} /><StorefrontText id="copy_863910b4ff1717af" fallback="View in Browser" />
                </a>
              </div>

              <div
                style={{
                  fontSize: "13px",
                  color: "#b8c4b2",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                }}
              >
                <span><StorefrontText id="copy_9a5649a42cb2fcef" fallback="Format:" /> <strong><StorefrontText id="copy_0cbeb39b2ff09b68" fallback="PDF Document" /></strong></span>
                {settings.formatted_size && <span>&bull; Size: <strong>{settings.formatted_size}</strong></span>}
                <span>&bull; Direct Origin Dispatch: <strong><StorefrontText id="copy_8f2965ee033b88d1" fallback="Siliguri Hub" /></strong></span>
              </div>
            </div>
          ) : (
            <div
              style={{
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.18)",
                borderRadius: "10px",
                padding: "24px 28px",
                maxWidth: "540px",
                margin: "0 auto",
              }}
            >
              <div style={{ fontSize: "16px", fontWeight: 600, color: "#ffffff", marginBottom: "8px" }}><StorefrontText id="copy_7a7b91a6de7f5aeb" fallback="Harvest Catalogue Updating" />
              </div>
              <p style={{ margin: "0 0 16px 0", fontSize: "14px", color: "#d3dbce", lineHeight: 1.5 }}><StorefrontText id="copy_68663a82e356b9d9" fallback="Our 2026 harvest dossier and wholesale catalog is being updated with the latest garden invoices. You can browse our live catalog online or contact our wholesale desk directly." />
              </p>
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
                <Link
                  href="/shop"
                  style={{
                    padding: "10px 18px",
                    borderRadius: "6px",
                    background: "#c5a059",
                    color: "#18231c",
                    fontSize: "13px",
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                ><StorefrontText id="copy_096e80ff858adcdf" fallback="Browse Online Shop" />
                </Link>
                <Link
                  href="/wholesale"
                  style={{
                    padding: "10px 18px",
                    borderRadius: "6px",
                    background: "rgba(255,255,255,0.15)",
                    color: "#ffffff",
                    fontSize: "13px",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                ><StorefrontText id="copy_5537bb1bd3fa0c50" fallback="Wholesale Inquiries" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* What's Inside the Brochure */}
      <section style={{ maxWidth: "1060px", margin: "60px auto", padding: "0 20px" }}>
        <div style={{ textAlign: "center", marginBottom: "48px" }}>
          <span
            style={{
              textTransform: "uppercase",
              fontSize: "12px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#23483a",
            }}
          ><StorefrontText id="copy_cff212011442b27c" fallback="Comprehensive Sourcing Portfolio" />
          </span>
          <h2
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(26px, 3.2vw, 38px)",
              color: "#18231c",
              margin: "6px 0 12px 0",
              fontWeight: 400,
            }}
          >
            What You&apos;ll Discover in the Catalogue
          </h2>
          <p style={{ color: "#586053", maxWidth: "600px", margin: "0 auto", fontSize: "15px" }}><StorefrontText id="copy_53dbea3e1c8e583c" fallback="Every batch of orthodox tea undergoes professional cupping protocols in our Siliguri laboratory prior to dispatch." />
          </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: "24px",
          }}
        >
          {/* Card 1 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "28px 24px",
              border: "1px solid #e5dfd3",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "rgba(35, 72, 58, 0.08)",
                color: "#23483a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <FileText size={22} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#18231c", margin: "0 0 8px 0" }}><StorefrontText id="copy_29cea881bc637f1e" fallback="Single-Estate Provenance" />
            </h3>
            <p style={{ fontSize: "14px", color: "#586053", lineHeight: 1.6, margin: 0 }}><StorefrontText id="copy_a110f5c27e26b265" fallback="Complete botanical terroir data: garden names (Giddapahar, Castleton, Mangalam), elevation metrics, harvest flush dates, and cultivar genetics (AV2, Heritage China)." />
            </p>
          </div>

          {/* Card 2 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "28px 24px",
              border: "1px solid #e5dfd3",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "rgba(35, 72, 58, 0.08)",
                color: "#23483a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Coffee size={22} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#18231c", margin: "0 0 8px 0" }}>
              Sensory Cupping &amp; Grades
            </h3>
            <p style={{ fontSize: "14px", color: "#586053", lineHeight: 1.6, margin: 0 }}>
              Detailed liquor evaluations, aroma descriptors, dry &amp; infused leaf character, and official whole leaf grades: FTGFOP1 Special, SFTGFOP, TGFOP1, and CTC BP/BOP.
            </p>
          </div>

          {/* Card 3 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "28px 24px",
              border: "1px solid #e5dfd3",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "rgba(35, 72, 58, 0.08)",
                color: "#23483a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Package size={22} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#18231c", margin: "0 0 8px 0" }}>
              Commercial Bulk &amp; Retail Packs
            </h3>
            <p style={{ fontSize: "14px", color: "#586053", lineHeight: 1.6, margin: 0 }}><StorefrontText id="copy_7f98d80f69d45215" fallback="Bulk nitrogen-flushed multi-ply sacks (5kg/25kg), sealed tin caddies, recyclable kraft pouches, and biodegradable pyramid tea bags for hospitality and retail brands." />
            </p>
          </div>

          {/* Card 4 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "28px 24px",
              border: "1px solid #e5dfd3",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "rgba(35, 72, 58, 0.08)",
                color: "#23483a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <ShieldCheck size={22} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#18231c", margin: "0 0 8px 0" }}><StorefrontText id="copy_c84a91a621abec89" fallback="Laboratory Purity Assurance" />
            </h3>
            <p style={{ fontSize: "14px", color: "#586053", lineHeight: 1.6, margin: 0 }}><StorefrontText id="copy_da851463fda8b448" fallback="100% unblended botanical purity. Zero chemical residues or synthetic flavorings. Tea Board of India verified paperwork with moisture levels strictly below 4.5%." />
            </p>
          </div>

          {/* Card 5 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "28px 24px",
              border: "1px solid #e5dfd3",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "rgba(35, 72, 58, 0.08)",
                color: "#23483a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Truck size={22} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#18231c", margin: "0 0 8px 0" }}><StorefrontText id="copy_79dccfff4fd857d2" fallback="Direct Siliguri Logistics" />
            </h3>
            <p style={{ fontSize: "14px", color: "#586053", lineHeight: 1.6, margin: 0 }}><StorefrontText id="copy_fc1c0fa74bf98727" fallback="Located right at the foot of the hills at Fulbari Ghoshpukur Bypass. Direct 24–48h express dispatch across India and international air cargo corridors." />
            </p>
          </div>

          {/* Card 6 */}
          <div
            style={{
              background: "#ffffff",
              borderRadius: "12px",
              padding: "28px 24px",
              border: "1px solid #e5dfd3",
              boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "rgba(35, 72, 58, 0.08)",
                color: "#23483a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "16px",
              }}
            >
              <Sparkles size={22} />
            </div>
            <h3 style={{ fontSize: "17px", fontWeight: 700, color: "#18231c", margin: "0 0 8px 0" }}>
              Blend Lab &amp; Custom Formulary
            </h3>
            <p style={{ fontSize: "14px", color: "#586053", lineHeight: 1.6, margin: 0 }}><StorefrontText id="copy_02793a21da28cce5" fallback="Proprietary botanical formulations crafted with Bengal spices, Gondhoraj peel, and heritage CTC or orthodox bases through our Siliguri atelier." />
            </p>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section
        style={{
          background: "#ffffff",
          borderTop: "1px solid #e2dbce",
          padding: "50px 20px",
        }}
      >
        <div
          style={{
            maxWidth: "860px",
            margin: "0 auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "24px",
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 6px 0", fontSize: "20px", fontWeight: 700, color: "#18231c" }}><StorefrontText id="copy_d75ce456eae57e1f" fallback="Need wholesale pricing or custom sample kits?" />
            </h3>
            <p style={{ margin: 0, fontSize: "14px", color: "#586053" }}><StorefrontText id="copy_d7ac5f7adff3b678" fallback="Our tea specialists in Siliguri can prepare custom 50g cupping sample flights for your cafe, restaurant or brand." />
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {isAvailable && (
              <a
                href="/api/brochure/download"
                download
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "10px 20px",
                  borderRadius: "6px",
                  background: "#23483a",
                  color: "#ffffff",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <Download size={16} /><StorefrontText id="copy_6183be0883d2a89c" fallback="Download PDF" />
              </a>
            )}
            <Link
              href="/wholesale"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 20px",
                borderRadius: "6px",
                border: "1px solid #d9d4c8",
                background: "#faf8f5",
                color: "#18231c",
                fontSize: "14px",
                fontWeight: 600,
                textDecoration: "none",
              }}
            ><StorefrontText id="copy_4e8f7a4b1b767f9f" fallback="Wholesale Desk" /> <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
