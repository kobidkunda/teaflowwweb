"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  BookOpen,
  Plus,
  Search,
  Eye,
  Edit2,
  Trash2,
  Clock,
  RotateCcw,
  Image as ImageIcon,
  AlertCircle,
} from "lucide-react";

export type BlogSummary = {
  id: number;
  slug: string;
  title: string;
  summary: string;
  excerpt: string;
  content: string;
  cover_image_url: string | null;
  author_name: string;
  status: "draft" | "published" | "archived";
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export function BlogListTable() {
  const [posts, setPosts] = useState<BlogSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    async function loadBlogs() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        params.set("limit", "50");

        const res = await fetch(`/api/admin/blogs?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load blog posts");
        const data = await res.json();
        if (mounted) {
          setPosts(data.posts || []);
        }
      } catch (err: unknown) {
        if (mounted) {
          setError(err instanceof Error ? err.message : "Error fetching articles");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    const timer = setTimeout(loadBlogs, 200);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [statusFilter, searchQuery]);

  return (
    <div className="blogs-table-root">
      {/* Top CTA and Search/Filter Bar */}
      <div className="blogs-toolbar-card">
        <div className="toolbar-left">
          <div className="search-input-wrap">
            <Search size={16} className="search-icon" aria-hidden="true" />
            <input
              type="text"
              placeholder="Search by article title, summary or author..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
              aria-label="Search articles"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="blog-status-filter" className="filter-label">
              Status:
            </label>
            <select
              id="blog-status-filter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="status-select"
            >
              <option value="all">All Articles</option>
              <option value="draft">Drafts</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>

            {(statusFilter !== "all" || searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setStatusFilter("all");
                  setSearchQuery("");
                }}
                className="reset-btn"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Reset
              </button>
            )}
          </div>
        </div>

        <Link href="/admin/blogs/new" className="button button-primary new-article-cta">
          <Plus size={16} aria-hidden="true" />
          <span>Write New Article</span>
        </Link>
      </div>

      {error && (
        <div className="error-alert" role="alert">
          <AlertCircle size={18} aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="blogs-loading" role="status">
          <Clock className="spin" size={24} aria-hidden="true" />
          <span>Loading editorial articles...</span>
        </div>
      ) : posts.length === 0 ? (
        <div className="blogs-empty-card">
          <BookOpen size={48} className="empty-icon" aria-hidden="true" />
          <h3>No blog articles found</h3>
          <p>Create your first journal article to share single-estate terroir stories.</p>
          <Link href="/admin/blogs/new" className="button button-primary" style={{ marginTop: 12 }}>
            <Plus size={16} aria-hidden="true" />
            <span>Create Article</span>
          </Link>
        </div>
      ) : (
        <div className="blogs-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th scope="col" style={{ width: 64 }}>Cover</th>
                <th scope="col">Title & Slug</th>
                <th scope="col">Author</th>
                <th scope="col">Status</th>
                <th scope="col">Published Date</th>
                <th scope="col" style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post) => (
                <tr key={post.id}>
                  <td>
                    {post.cover_image_url ? (
                      <div className="thumb-preview-wrap">
                        <Image
                          src={post.cover_image_url}
                          alt=""
                          width={50}
                          height={38}
                          sizes="50px"
                          className="thumb-img"
                        />
                      </div>
                    ) : (
                      <div className="thumb-placeholder" title="No cover photo">
                        <ImageIcon size={18} aria-hidden="true" />
                      </div>
                    )}
                  </td>
                  <td>
                    <div className="title-cell">
                      <Link href={`/admin/blogs/${post.id}`} className="blog-title-link">
                        {post.title}
                      </Link>
                      <span className="blog-slug font-mono">{post.slug}</span>
                    </div>
                  </td>
                  <td className="author-cell">{post.author_name}</td>
                  <td>
                    <span className={`status-pill status-${post.status}`}>
                      {post.status}
                    </span>
                  </td>
                  <td className="date-cell">
                    {post.published_at ? (
                      new Date(post.published_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div className="actions-cluster">
                      <Link
                        href={`/admin/blogs/${post.id}`}
                        className="table-action-btn view-btn"
                        title="Read-only preview dossier"
                      >
                        <Eye size={14} aria-hidden="true" />
                        <span>Preview</span>
                      </Link>
                      <Link
                        href={`/admin/blogs/${post.id}/edit`}
                        className="table-action-btn edit-btn"
                        title="Edit article"
                      >
                        <Edit2 size={14} aria-hidden="true" />
                        <span>Edit</span>
                      </Link>
                      <Link
                        href={`/admin/blogs/${post.id}/delete`}
                        className="table-action-btn delete-btn"
                        title="Delete confirmation view"
                      >
                        <Trash2 size={14} aria-hidden="true" />
                        <span>Delete</span>
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style jsx>{`
        .blogs-table-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .blogs-toolbar-card {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          padding: 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .toolbar-left {
          display: flex;
          align-items: center;
          gap: 16px;
          flex: 1;
          flex-wrap: wrap;
        }

        .search-input-wrap {
          position: relative;
          min-width: 280px;
          flex: 1;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          top: 50%;
          transform: translateY(-50%);
          color: #7b8075;
          pointer-events: none;
        }

        .search-input {
          width: 100%;
          padding: 9px 12px 9px 36px;
          font-size: 13px;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          background: #ffffff;
          box-sizing: border-box;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .filter-label {
          font-size: 12px;
          font-weight: 600;
          color: #555850;
        }

        .status-select {
          padding: 8px 12px;
          font-size: 13px;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 6px;
          background: #ffffff;
        }

        .reset-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 600;
          color: #6a6e64;
          background: #ede9df;
          border: 1px solid #d9d4c8;
          border-radius: 6px;
          cursor: pointer;
        }

        .new-article-cta {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .blogs-table-wrap {
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          overflow-x: auto;
        }

        .thumb-preview-wrap {
          width: 50px;
          height: 38px;
          border-radius: 4px;
          overflow: hidden;
          background: #ede9df;
          border: 1px solid #d9d4c8;
        }

        .thumb-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .thumb-placeholder {
          width: 50px;
          height: 38px;
          border-radius: 4px;
          background: #ede9df;
          border: 1px solid #d9d4c8;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #9ea399;
        }

        .title-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .blog-title-link {
          font-weight: 600;
          color: var(--forest, #1d2a24);
          text-decoration: underline;
          font-size: 14px;
        }

        .blog-slug {
          font-size: 11px;
          color: #7b8075;
        }

        .author-cell {
          font-size: 13px;
          color: #555850;
        }

        .date-cell {
          font-size: 12px;
          color: #6a6e64;
        }

        .status-pill {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .status-published {
          background: rgba(35, 72, 58, 0.12);
          color: var(--pine, #23483a);
          border: 1px solid rgba(35, 72, 58, 0.3);
        }

        .status-draft {
          background: rgba(179, 145, 86, 0.15);
          color: #7d6537;
          border: 1px solid rgba(179, 145, 86, 0.3);
        }

        .status-archived {
          background: #ede9df;
          color: #7b8075;
          border: 1px solid #d9d4c8;
        }

        .actions-cluster {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .table-action-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-decoration: none;
        }

        .view-btn {
          background: rgba(35, 72, 58, 0.08);
          color: var(--pine, #23483a);
          border: 1px solid rgba(35, 72, 58, 0.2);
        }

        .edit-btn {
          background: rgba(179, 145, 86, 0.12);
          color: #7d6537;
          border: 1px solid rgba(179, 145, 86, 0.3);
        }

        .delete-btn {
          background: rgba(143, 47, 42, 0.08);
          color: #8f2f2a;
          border: 1px solid rgba(143, 47, 42, 0.2);
        }

        .blogs-empty-card {
          text-align: center;
          padding: 48px;
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
        }

        .empty-icon {
          color: #aeb7aa;
          margin-bottom: 12px;
        }

        .blogs-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 48px;
          color: #6a6e64;
        }

        .error-alert {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          background: #fdf2f2;
          color: #8f2f2a;
          border: 1px solid #f8b4b4;
          border-radius: 6px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
