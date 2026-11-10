"use client";

import { setStudioPreview } from "../studio/previewHandoff";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import styles from "../styles/PrivateLabel.module.css";
import { SectionHeading, PreviewNotice } from "../shared/StudioPrimitives";

export function StudioTeaserPreview() {
  const [format, setFormat] = useState<"pouch" | "tin">("pouch");
  const [brandName, setBrandName] = useState("TEAFLOWW RESERVE");
  const [view, setView] = useState<"front" | "back">("front");
  const [teaType, setTeaType] = useState("Darjeeling First Flush");
  const [quantity, setQuantity] = useState(500);


  return (
    <section className={styles.teaserSection} aria-label="Interactive Studio Preview Teaser">
      <div className={styles.contentContainer}>
        <SectionHeading
          title="Interactive Preview: Design Your Custom Pack"
          subtitle="Explore your brand name on a packaging concept, then configure your project in the studio."
          align="center"
        />

        <div className={styles.teaserGrid}>
          {/* Controls Column */}
          <div className={styles.teaserCard}>
            <div style={{ marginBottom: "20px" }}>
              <label
                htmlFor="brand-name-input"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#171713",
                  marginBottom: "8px",
                }}
              >
                Your Brand Name
              </label>
              <input
                id="brand-name-input"
                type="text"
                value={brandName}
                onChange={(e) => setBrandName(e.target.value.slice(0, 32))}
                placeholder="e.g., Nirva Botanicals"
                maxLength={32}
                style={{
                  width: "100%",
                  minHeight: "44px",
                  padding: "10px 14px",
                  fontSize: "1rem",
                  border: "1.5px solid #DDE4DC",
                  borderRadius: "6px",
                  boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
              />
            </div>

            <div style={{ marginBottom: "20px" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#171713",
                  marginBottom: "8px",
                }}
              >
                Packaging Structure
              </span>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setFormat("pouch")}
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    padding: "10px",
                    borderRadius: "6px",
                    border: format === "pouch" ? "2px solid #143C31" : "1px solid #DDE4DC",
                    backgroundColor: format === "pouch" ? "rgba(20, 60, 49, 0.08)" : "#FFFCF7",
                    color: format === "pouch" ? "#143C31" : "#65746D",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Matte Stand-Up Pouch
                </button>
                <button
                  type="button"
                  onClick={() => setFormat("tin")}
                  style={{
                    flex: 1,
                    minHeight: "44px",
                    padding: "10px",
                    borderRadius: "6px",
                    border: format === "tin" ? "2px solid #143C31" : "1px solid #DDE4DC",
                    backgroundColor: format === "tin" ? "rgba(20, 60, 49, 0.08)" : "#FFFCF7",
                    color: format === "tin" ? "#143C31" : "#65746D",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Artisanal Metal Tin
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                htmlFor="tea-type-select"
                style={{
                  display: "block",
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "#171713",
                  marginBottom: "8px",
                }}
              >
                Single-Estate Tea Grade
              </label>
              <select
                id="tea-type-select"
                value={teaType}
                onChange={(e) => setTeaType(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "44px",
                  padding: "10px 14px",
                  fontSize: "0.9375rem",
                  border: "1.5px solid #DDE4DC",
                  borderRadius: "6px",
                  backgroundColor: "#FFFCF7",
                  boxSizing: "border-box",
                }}
              >
                <option value="Darjeeling First Flush">Darjeeling First Flush (FTGFOP1)</option>
                <option value="Assam Orthodox Golden Tips">Assam Orthodox Golden Tips (TGFOP)</option>
                <option value="Kangra High Elevation Green">Kangra High Elevation Green</option>
              </select>
            </div>

            <p style={{ color: "#65746D", fontSize: "0.875rem" }}>Illustrative preview. Select available tea, packaging and print options in the studio for a server-calculated estimate.</p>

            <Link
              href="/private-label/studio"
              onClick={() => {
                setStudioPreview({ brandName, quantityUnits: quantity });
              }}
              className={styles.cardActionLink}
              style={{
                width: "100%",
                minHeight: "48px",
                fontSize: "1rem",
                boxSizing: "border-box",
              }}
            >
              Open Full Configurator in Studio &rarr;
            </Link>
          </div>

          {/* Visual Mockup Preview Column */}
          <div className={styles.teaserCard}>
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "16px" }}>
              <button
                type="button"
                onClick={() => setView("front")}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: view === "front" ? "#143C31" : "rgba(20, 60, 49, 0.08)",
                  color: view === "front" ? "#FFFCF7" : "#143C31",
                  cursor: "pointer",
                }}
              >
                Front View
              </button>
              <button
                type="button"
                onClick={() => setView("back")}
                style={{
                  padding: "6px 14px",
                  fontSize: "0.8125rem",
                  fontWeight: 600,
                  borderRadius: "4px",
                  border: "none",
                  backgroundColor: view === "back" ? "#143C31" : "rgba(20, 60, 49, 0.08)",
                  color: view === "back" ? "#FFFCF7" : "#143C31",
                  cursor: "pointer",
                }}
              >
                Back View
              </button>
            </div>

            <div className={styles.teaserCanvasWrapper} style={{ position: "relative", minHeight: "520px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              {format === "pouch" ? (
                <div className={styles.teaserMockupStage}>
                  <Image
                    src={view === "front" ? "/images/private-label/teafloww-reserve-front.webp" : "/images/private-label/teafloww-reserve-back.webp"}
                    alt={view === "front" ? `${brandName.trim() || "TEAFLOWW RESERVE"} Front View Packaging Mockup` : "TEAFLOWW RESERVE Darjeeling First Flush Back View Packaging Mockup"}
                    fill
                    sizes="(max-width: 768px) 90vw, 480px"
                    style={{ objectFit: "contain", borderRadius: "10px" }}
                    priority
                  />
                  {view === "front" && brandName.trim() && brandName.trim().toUpperCase() !== "TEAFLOWW RESERVE" && (
                    <div
                      style={{
                        position: "absolute",
                        top: "44%",
                        left: "50%",
                        transform: "translate(-50%, -50%)",
                        width: "65%",
                        maxWidth: "260px",
                        background: "rgba(17, 26, 23, 0.94)",
                        border: "1.5px solid #D7B474",
                        borderRadius: "6px",
                        padding: "10px 14px",
                        textAlign: "center",
                        boxShadow: "0 6px 18px rgba(0,0,0,0.55)",
                        zIndex: 2,
                      }}
                    >
                      <span className={styles.teaserBrandHeading} style={{ fontSize: "1.125rem", color: "#FFFCF7", display: "block" }}>
                        {brandName.trim()}
                      </span>
                      <p className={styles.teaserTeaType} style={{ fontSize: "0.8125rem", margin: "4px 0 0" }}>{teaType}</p>
                      <div
                        style={{
                          marginTop: "8px",
                          fontSize: "0.6875rem",
                          color: "#D7B474",
                          borderTop: "1px solid rgba(215, 180, 116, 0.4)",
                          paddingTop: "6px",
                        }}
                      >
                        100g &bull; Single-Estate Whole Leaf
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={styles.teaserMockupStage}>
                  <Image
                    src="/images/private-label/tin-concept.webp"
                    alt="Artisanal Metal Tin Caddy Mockup"
                    fill
                    sizes="(max-width: 768px) 90vw, 480px"
                    style={{ objectFit: "contain", borderRadius: "10px" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      top: "48%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "60%",
                      maxWidth: "240px",
                      background: "rgba(20, 60, 49, 0.92)",
                      border: "1.5px solid #D7B474",
                      borderRadius: "6px",
                      padding: "10px 14px",
                      textAlign: "center",
                      boxShadow: "0 6px 18px rgba(0,0,0,0.55)",
                      zIndex: 2,
                    }}
                  >
                    {view === "front" ? (
                      <>
                        <span className={styles.teaserBrandHeading} style={{ fontSize: "1rem", color: "#FFFCF7", display: "block" }}>
                          {brandName.trim() || "YOUR BRAND"}
                        </span>
                        <p className={styles.teaserTeaType} style={{ fontSize: "0.8125rem", margin: "4px 0 0" }}>{teaType}</p>
                        <div
                          style={{
                            marginTop: "8px",
                            fontSize: "0.6875rem",
                            color: "#D7B474",
                            borderTop: "1px solid rgba(215, 180, 116, 0.4)",
                            paddingTop: "6px",
                          }}
                        >
                          100g &bull; Single-Estate Whole Leaf
                        </div>
                      </>
                    ) : (
                      <div style={{ fontSize: "0.6875rem", color: "#A3B8B0", textAlign: "left", width: "100%" }}>
                        <p style={{ margin: "0 0 4px", fontWeight: "bold", color: "#FFFCF7" }}>
                          FSSAI LIC: 19CTHPK8646J2ZY
                        </p>
                        <p style={{ margin: "0 0 2px" }}>Packed by: Nirva / TeaFloww Works</p>
                        <p style={{ margin: "0 0 2px" }}>Origin: Single Estate, Siliguri hub</p>
                        <p style={{ margin: "0" }}>Best Before: 24 Months from Packaging</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div style={{ marginTop: "16px", width: "100%", textAlign: "center" }}>
                <PreviewNotice text="Digital mockup — illustrative only" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
