import React from "react";
import { notFound } from "next/navigation";
import { getMediaById, checkMediaReferences } from "@/lib/media";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import { MediaDeleteConfirmationClient } from "@/components/admin/media/MediaDeleteConfirmationClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function MediaDeletePage({ params }: Props) {
  const { id } = await params;
  const numId = Number(id);
  if (isNaN(numId)) {
    notFound();
  }

  const asset = getMediaById(numId);
  if (!asset) {
    notFound();
  }

  const refCheck = checkMediaReferences(numId, asset.url);

  return (
    <AdminAuthGate>
      <MediaDeleteConfirmationClient asset={asset} refCheck={refCheck} />
    </AdminAuthGate>
  );
}
