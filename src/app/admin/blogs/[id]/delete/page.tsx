import React from "react";
import { BlogDeleteConfirm } from "@/components/admin/content/BlogDeleteConfirm";

export const metadata = {
  title: "Delete Article | Admin | Himalayan Tea House",
  description: "Dedicated safe deletion confirmation for blog articles.",
};

export default async function AdminBlogDeletePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="blog-delete-page">
      <BlogDeleteConfirm blogId={id} />
    </div>
  );
}
