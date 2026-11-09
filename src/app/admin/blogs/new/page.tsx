import React from "react";
import { BlogArticleForm } from "@/components/admin/content/BlogArticleForm";

export const metadata = {
  title: "New Journal Article | Admin | Himalayan Tea House",
  description: "Compose and publish a new editorial journal article with rich markdown formatting.",
};

export default function AdminBlogNewPage() {
  return (
    <div className="blog-create-page">
      <BlogArticleForm isEditing={false} />
    </div>
  );
}
