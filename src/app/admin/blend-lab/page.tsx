"use client";

import React from "react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { BlendLabAdminClient } from "@/components/admin/blend-lab/BlendLabAdminClient";

export default function AdminBlendLabPage() {
  return (
    <AdminAuthGate>
      <BlendLabAdminClient />
    </AdminAuthGate>
  );
}
