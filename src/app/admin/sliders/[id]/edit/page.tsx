"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { SliderForm, type SliderFormData } from "@/components/admin/sliders/SliderForm";
import { ArrowLeft, AlertCircle } from "lucide-react";

export default function EditSliderPage() {
  return (
    <AdminAuthGate>
      <EditSliderContent />
    </AdminAuthGate>
  );
}

function EditSliderContent() {
  const params = useParams();
  const idStr = params?.id as string;
  const sliderId = Number(idStr);

  const [sliderData, setSliderData] = useState<SliderFormData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    async function fetchSlider() {
      try {
        const res = await fetch(`/api/admin/sliders/${sliderId}`, {
          credentials: "same-origin",
        });
        if (!res.ok) {
          if (mounted) setError("Hero slider not found or unable to load.");
          return;
        }
        const data = (await res.json()) as { slider: SliderFormData };
        if (mounted) setSliderData(data.slider);
      } catch {
        if (mounted) setError("Network error loading hero slider.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (sliderId) void fetchSlider();
    return () => {
      mounted = false;
    };
  }, [sliderId]);

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: "center", color: "#6a6e64" }}>
        <p role="status">Loading slider for editing…</p>
      </div>
    );
  }

  if (error || !sliderData) {
    return (
      <div
        style={{
          padding: 32,
          background: "#fbf8f1",
          borderRadius: 8,
          border: "1px solid #d9d4c8",
          maxWidth: 600,
          margin: "40px auto",
          textAlign: "center",
        }}
      >
        <AlertCircle size={32} color="#a42a1b" style={{ margin: "0 auto 12px" }} />
        <h2 style={{ fontSize: 20, color: "#1d2a24", margin: "0 0 8px 0" }}>
          Slider Not Found
        </h2>
        <p style={{ color: "#6a6e64", fontSize: 14, marginBottom: 20 }}>
          {error || `Unable to locate slider #${sliderId}. It may have been removed.`}
        </p>
        <Link
          href="/admin/sliders"
          className="button button-outline"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          <ArrowLeft size={14} />
          <span>Return to Hero Sliders</span>
        </Link>
      </div>
    );
  }

  return <SliderForm initialData={sliderData} isEdit={true} sliderId={sliderId} />;
}
