"use client";

import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { SliderForm } from "@/components/admin/sliders/SliderForm";

export default function NewSliderPage() {
  return (
    <AdminAuthGate>
      <SliderForm isEdit={false} />
    </AdminAuthGate>
  );
}
