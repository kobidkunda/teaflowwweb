import React from "react";
import { BlogPreviewDossier } from "@/components/admin/content/BlogPreviewDossier";

export const metadata = {
  title: "Article Preview | Admin | Himalayan Tea House",
  description: "Read-only journal article preview formatted like the storefront.",
};

export default async function AdminBlogDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="blog-detail-page">
      <BlogPreviewDossier blogId={id} />
    </div>
  );
}
