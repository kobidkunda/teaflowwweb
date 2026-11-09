import React from "react";
import { notFound } from "next/navigation";
import { getMediaById } from "@/lib/media";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { MediaEditFormClient } from "@/components/admin/media/MediaEditFormClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MediaEditPage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) {
    notFound();
  }

  const asset = getMediaById(numId);
  if (!asset) {
    notFound();
  }

  return (
    <AdminAuthGate>
      <MediaEditFormClient initialAsset={asset} />
    </AdminAuthGate>
  );
}
