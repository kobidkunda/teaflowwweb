import React from "react";
import { BlogArticleForm } from "@/components/admin/content/BlogArticleForm";

export const metadata = {
  title: "Edit Journal Article | Admin | Himalayan Tea House",
  description: "Dedicated editorial edit form for blog articles.",
};

export default async function AdminBlogEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="blog-edit-page">
      <BlogArticleForm blogId={id} isEditing={true} />
    </div>
  );
}
