import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import type { Metadata } from "next";
import { WholesaleForm } from "@/components/wholesale/WholesaleForm";
import { getStoreSettings } from "@/lib/storeSettings";
import {
  Sparkles,
  ShieldCheck,
  Package,
  Truck,
  Coffee,
  Mail,
  ArrowRight,
  Download,
  FileText,
} from "lucide-react";

import { getPageOrDefault } from "@/lib/pages";
import { constructMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const page = getPageOrDefault("wholesale");
  return constructMetadata({
    title: page.meta_title || "Wholesale & Bulk Tea Sourcing | Single-Estate Direct",
    description:
      page.meta_description ||
      "Direct garden sourcing for specialty cafes, hotels, curators and tea brands. Pure single-estate orthodox teas from Darjeeling, Assam, and Nepal at garden-direct pricing.",
    path: "/wholesale",
    ogImage: "/images/hero-himalayan-tea.jpg",
  });
}

export default function WholesalePage() {
  const settings = getStoreSettings();
  const page = getPageOrDefault("wholesale");
  const whatsappNumber = settings.whatsapp_number || "+91 98320 12345";
  const eyebrow = page.eyebrow || "Single-Estate Direct Procurement";
  const headline = page.headline || "Wholesale Tea Sourcing, Straight From Origin.";
  const subtitle = page.subtitle || "We partner directly with specialty cafes, fine restaurants, boutique hotels, and international distributors. Source single-estate Darjeeling, Assam, and Kangra teas directly from our Siliguri origin facility with verified garden paperwork and zero broker markups.";

  return (
    <div className="wholesale-page" style={{ background: "var(--paper)", minHeight: "100vh" }}>
      {/* Hero Banner */}
      <section
        style={{
          background: "linear-gradient(135deg, #16241a 0%, #1f3726 60%, #18281e 100%)",
          color: "#f6f1e7",
          padding: "70px 20px 80px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            maxWidth: "1140px",
            margin: "0 auto",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))",
            gap: "50px",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "rgba(214, 200, 167, 0.15)",
                border: "1px solid rgba(214, 200, 167, 0.3)",
                padding: "6px 14px",
                borderRadius: "50px",
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "#d6c8a7",
                marginBottom: "20px",
              }}
            >
              <Sparkles size={14} color="#d6c8a7" /> {eyebrow}
            </div>

            <h1
              style={{
                fontFamily: "Georgia, serif",
                fontSize: "clamp(36px, 4.5vw, 56px)",
                fontWeight: 400,
                lineHeight: 1.1,
                margin: "0 0 20px 0",
                letterSpacing: "-0.03em",
              }}
            >
              {headline}
            </h1>

            <p
              style={{
                fontSize: "16px",
                lineHeight: 1.65,
                color: "#d3dbce",
                margin: "0 0 32px 0",
                maxWidth: "540px",
              }}
            >
              {subtitle}
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 120px), 1fr))",
                gap: "16px",
                paddingTop: "10px",
                borderTop: "1px solid rgba(255, 255, 255, 0.12)",
              }}
            >
              <div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#ffffff" }}> <StorefrontText id="copy_4020fc5605ac30d0" fallback="5 kg" /> </div>
                <div style={{ fontSize: "12px", color: "#b8c4b2" }}> <StorefrontText id="copy_0ef9b73b52d4bd72" fallback="Low Trial Minimums" /> </div>
              </div>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#ffffff" }}> <StorefrontText id="copy_d2912e0f137251ea" fallback="24–48h" /> </div>
                <div style={{ fontSize: "12px", color: "#b8c4b2" }}> <StorefrontText id="copy_db1941afe27d093e" fallback="Direct Hub Dispatch" /> </div>
              </div>
              <div>
                <div style={{ fontSize: "22px", fontWeight: 700, color: "#ffffff" }}>100%</div>
                <div style={{ fontSize: "12px", color: "#b8c4b2" }}> <StorefrontText id="copy_d5b27921245ad623" fallback="Garden Traceability" /> </div>
              </div>
            </div>

            <div style={{ marginTop: "24px" }}>
              <a
                href="/brochure"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "rgba(255, 255, 255, 0.12)",
                  border: "1px solid rgba(255, 255, 255, 0.25)",
                  color: "#ffffff",
                  padding: "10px 18px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                <Download size={15} /> <StorefrontText id="copy_wholesale_brochure_cta" fallback="Download Wholesale Brochure &amp; Catalogue (PDF)" />
              </a>
            </div>
          </div>

          {/* Form placement directly in hero or side card */}
          <div>
            <WholesaleForm />
          </div>
        </div>
      </section>

      {/* Trust & Advantages Section */}
      <section style={{ padding: "80px 20px", maxWidth: "1140px", margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: "50px" }}>
          <span className="eyebrow">Why Hospitality &amp; Retail Choose Us</span>
          <h2
            style={{
              fontFamily: "Georgia, serif",
              fontSize: "clamp(28px, 3.2vw, 42px)",
              color: "#18231c",
              margin: "6px 0 16px 0",
            }}
          >
            Built for Commercial Precision &amp; Botanical Truth
          </h2>
          <p style={{ color: "#586053", maxWidth: "620px", margin: "0 auto", fontSize: "15px" }}> <StorefrontText id="copy_53dbea3e1c8e583c" fallback="Every batch of orthodox tea undergoes professional cupping protocols in our Siliguri laboratory prior to dispatch." /> </p>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 250px), 1fr))",
            gap: "24px",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "28px 24px",
              border: "1px solid #e2dbce",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "rgba(35, 72, 58, 0.1)",
                color: "#23483a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "18px",
              }}
            >
              <ShieldCheck size={24} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#18231c", margin: "0 0 10px 0" }}> <StorefrontText id="copy_e0015b927296ad7c" fallback="Truthful Sourcing Only" /> </h3>
            <p style={{ fontSize: "14px", color: "#586053", lineHeight: 1.6, margin: 0 }}> <StorefrontText id="copy_c033ca35e1140d22" fallback="Never adulterated or blended with filler grades. You receive unblended, invoice-certified single-estate teas with harvest date and elevation metrics." /> </p>
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "28px 24px",
              border: "1px solid #e2dbce",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "rgba(35, 72, 58, 0.1)",
                color: "#23483a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "18px",
              }}
            >
              <Package size={24} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#18231c", margin: "0 0 10px 0" }}>
              Custom Packaging &amp; Blending
            </h3>
            <p style={{ fontSize: "14px", color: "#586053", lineHeight: 1.6, margin: 0 }}> <StorefrontText id="copy_0131b5dbc4cb7a2f" fallback="From multi-ply nitrogen-flushed bulk sacks (5kg/25kg) to branded retail pouches and pyramidal tea bags with food-grade PLA mesh." /> </p>
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "28px 24px",
              border: "1px solid #e2dbce",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "rgba(35, 72, 58, 0.1)",
                color: "#23483a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "18px",
              }}
            >
              <Coffee size={24} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#18231c", margin: "0 0 10px 0" }}>
              Sample Kits &amp; Staff Training
            </h3>
            <p style={{ fontSize: "14px", color: "#586053", lineHeight: 1.6, margin: 0 }}> <StorefrontText id="copy_1fd134637a558f9e" fallback="We provide curations of freshly harvested grades along with detailed temperature, water mineral ratio, and steeping parameter guides for your barista teams." /> </p>
          </div>

          <div
            style={{
              background: "#ffffff",
              borderRadius: "14px",
              padding: "28px 24px",
              border: "1px solid #e2dbce",
            }}
          >
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "10px",
                background: "rgba(35, 72, 58, 0.1)",
                color: "#23483a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: "18px",
              }}
            >
              <Truck size={24} />
            </div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#18231c", margin: "0 0 10px 0" }}>
              Pan-India &amp; Global Freight
            </h3>
            <p style={{ fontSize: "14px", color: "#586053", lineHeight: 1.6, margin: 0 }}> <StorefrontText id="copy_9b3211270d186b22" fallback="Domestic express road/air transit through verified courier logistics. Phytosanitary certificates and COO documentation for international export." /> </p>
          </div>
        </div>
      </section>

      {/* Direct Contact Bar */}
      <section
        style={{
          background: "#ece6da",
          borderTop: "1px solid #dfd8cb",
          padding: "40px 20px",
        }}
      >
        <div
          style={{
            maxWidth: "900px",
            margin: "0 auto",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px",
          }}
        >
          <div>
            <h3 style={{ fontSize: "18px", fontWeight: 700, color: "#18231c", margin: "0 0 4px 0" }}> <StorefrontText id="copy_b31b3cd51f65e201" fallback="Need immediate custom quotes or urgent harvest samples?" /> </h3>
            <p style={{ fontSize: "13px", color: "#52594e", margin: 0 }}> <StorefrontText id="copy_c1322da81571225f" fallback="Connect directly with our origin dispatch desk in Siliguri." /> </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
            <a
              href={`https://wa.me/${whatsappNumber.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#25D366",
                color: "#ffffff",
                padding: "10px 18px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <span> <StorefrontText id="copy_9f55f1d26e22174d" fallback="WhatsApp:" /> {whatsappNumber}</span>
              <ArrowRight size={14} />
            </a>

            <a
              href={`mailto:${settings.contact_email}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                background: "#ffffff",
                border: "1px solid #cfc7ba",
                color: "#18231c",
                padding: "10px 18px",
                borderRadius: "999px",
                fontSize: "13px",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              <Mail size={14} />
              <span>{settings.contact_email}</span>
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
