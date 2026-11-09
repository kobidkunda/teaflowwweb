"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Trash2,
  AlertTriangle,
  Clock,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import type { BlogSummary } from "./BlogListTable";

export function BlogDeleteConfirm({ blogId }: { blogId: string }) {
  const router = useRouter();
  const [post, setPost] = useState<BlogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/blogs/${encodeURIComponent(blogId)}`);
        if (!res.ok) throw new Error("Blog article not found");
        const data = await res.json();
        if (mounted) {
          setPost(data.post);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Failed to load article");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    void load();
    return () => {
      mounted = false;
    };
  }, [blogId]);

  if (loading) {
    return (
      <div className="delete-card" role="status">
        <Clock className="spin" size={24} aria-hidden="true" />
        <span>Loading article #{blogId} for deletion confirmation...</span>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="delete-card error">
        <AlertTriangle size={32} className="text-amber" aria-hidden="true" />
        <h2>Article Not Found</h2>
        <p>{error || "Unable to locate article."}</p>
        <Link href="/admin/blogs" className="button button-outline">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Articles</span>
        </Link>
      </div>
    );
  }

  async function handleConfirmDelete(e: React.FormEvent) {
    e.preventDefault();
    setDeleting(true);
    setDeleteError(null);

    try {
      const res = await fetch(`/api/admin/blogs/${encodeURIComponent(blogId)}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete article");
      }

      setDeleteSuccess(true);
      setTimeout(() => {
        router.push("/admin/blogs");
      }, 900);
    } catch (err: unknown) {
      setDeleteError(err instanceof Error ? err.message : "Deletion failed");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="delete-page-root">
      <div>
        <Link href={`/admin/blogs/${post.id}`} className="back-link">
          <ArrowLeft size={14} aria-hidden="true" />
          <span>Back to Article Preview</span>
        </Link>
        <h1 className="delete-page-title">Delete Blog Article</h1>
        <p className="delete-subtitle">
          Dedicated full-page deletion confirmation (Zero Modals).
        </p>
      </div>

      <div className="delete-card warning-box">
        <AlertTriangle size={36} className="text-danger" aria-hidden="true" />
        <h2 className="confirm-heading">Are you sure you want to delete this article?</h2>
        <p className="confirm-desc">
          This action will permanently remove the article and its publication history from the store
          editorial database. This action cannot be undone.
        </p>

        <div className="article-meta-summary">
          <div className="meta-row">
            <span>Title:</span>
            <strong>{post.title}</strong>
          </div>
          <div className="meta-row">
            <span>URL Slug:</span>
            <span className="font-mono">/journal/{post.slug}</span>
          </div>
          <div className="meta-row">
            <span>Author:</span>
            <span>{post.author_name}</span>
          </div>
          <div className="meta-row">
            <span>Status:</span>
            <span className={`status-pill status-${post.status}`}>{post.status}</span>
          </div>
        </div>

        {deleteSuccess ? (
          <div className="delete-success-msg" role="status">
            <CheckCircle size={18} aria-hidden="true" />
            <span>Article deleted successfully. Redirecting to journal index...</span>
          </div>
        ) : (
          <form onSubmit={handleConfirmDelete} className="delete-action-form">
            {deleteError && (
              <div className="delete-error-alert" role="alert">
                <AlertCircle size={16} aria-hidden="true" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="button-actions-row">
              <button
                type="submit"
                disabled={deleting}
                className="button button-danger"
              >
                <Trash2 size={16} aria-hidden="true" />
                <span>{deleting ? "Deleting Article..." : "Permanently Delete Article"}</span>
              </button>

              <Link href={`/admin/blogs/${post.id}`} className="button button-outline">
                Cancel (Keep Article)
              </Link>
            </div>
          </form>
        )}
      </div>

      <style jsx>{`
        .delete-page-root {
          max-width: 640px;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--pine, #23483a);
          margin-bottom: 8px;
          text-decoration: none;
        }

        .delete-page-title {
          font-size: clamp(22px, 3vw, 28px);
          font-family: Georgia, serif;
          color: var(--forest, #1d2a24);
          margin: 0;
        }

        .delete-subtitle {
          font-size: 13px;
          color: #6a6e64;
          margin-top: 4px;
        }

        .delete-card {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 32px 24px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .warning-box {
          border-color: #f8b4b4;
          background: #fffafa;
        }

        .confirm-heading {
          font-family: Georgia, serif;
          font-size: 20px;
          color: #8f2f2a;
          margin: 0;
        }

        .confirm-desc {
          font-size: 14px;
          color: #555850;
          line-height: 1.5;
          margin: 0;
        }

        .article-meta-summary {
          background: #ede9df;
          border-radius: 6px;
          padding: 14px 18px;
          width: 100%;
          box-sizing: border-box;
          display: flex;
          flex-direction: column;
          gap: 8px;
          text-align: left;
          font-size: 13px;
        }

        .meta-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .status-pill {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .status-published {
          background: rgba(35, 72, 58, 0.12);
          color: var(--pine, #23483a);
        }

        .status-draft {
          background: rgba(179, 145, 86, 0.15);
          color: #7d6537;
        }

        .delete-action-form {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .button-actions-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .button-danger {
          background: #8f2f2a;
          color: #ffffff;
          border: 1px solid #722420;
          padding: 10px 18px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 6px;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .button-danger:hover {
          background: #722420;
        }

        .delete-error-alert {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          background: #fdf2f2;
          color: #8f2f2a;
          border: 1px solid #f8b4b4;
          border-radius: 6px;
          font-size: 13px;
          text-align: left;
        }

        .delete-success-msg {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 18px;
          background: rgba(35, 72, 58, 0.15);
          color: var(--pine, #23483a);
          border: 1px solid rgba(35, 72, 58, 0.3);
          border-radius: 6px;
          font-size: 14px;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
