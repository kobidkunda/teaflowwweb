"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Edit2,
  Trash2,
  Clock,
  User,
  Calendar,
  AlertTriangle,
} from "lucide-react";
import type { BlogSummary } from "./BlogListTable";

function renderMarkdownHtml(md: string): string {
  if (!md) return "";
  let html = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html.replace(/^### (.*$)/gim, '<h3 class="journal-h3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="journal-h2">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="journal-h1">$1</h1>');
  html = html.replace(/^\> (.*$)/gim, '<blockquote class="journal-quote">$1</blockquote>');
  html = html.replace(/\*\*(.*?)\*\*/gim, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/gim, "<em>$1</em>");
  html = html.replace(
    /\[(.*?)\]\((.*?)\)/gim,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="journal-link">$1</a>'
  );
  html = html.replace(/^\- (.*$)/gim, '<li class="journal-li">$1</li>');

  const paragraphs = html.split(/\n\s*\n/);
  html = paragraphs
    .map((p) => {
      p = p.trim();
      if (!p) return "";
      if (
        p.startsWith("<h1") ||
        p.startsWith("<h2") ||
        p.startsWith("<h3") ||
        p.startsWith("<blockquote") ||
        p.startsWith("<li")
      ) {
        return p;
      }
      return `<p class="journal-p">${p.replace(/\n/g, "<br/>")}</p>`;
    })
    .join("\n");

  return html;
}

export function BlogPreviewDossier({ blogId }: { blogId: string }) {
  const [post, setPost] = useState<BlogSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="dossier-state-card" role="status">
        <Clock className="spin" size={24} aria-hidden="true" />
        <span>Loading journal article #{blogId}...</span>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="dossier-state-card error">
        <AlertTriangle size={32} className="text-amber" aria-hidden="true" />
        <h2>Article Not Found</h2>
        <p>{error || "The requested article could not be loaded."}</p>
        <Link href="/admin/blogs" className="button button-outline">
          <ArrowLeft size={16} aria-hidden="true" />
          <span>Back to Articles</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="blog-preview-root">
      {/* Navigation Topbar */}
      <div className="preview-topbar">
        <div>
          <Link href="/admin/blogs" className="back-link">
            <ArrowLeft size={14} aria-hidden="true" />
            <span>Back to Journal Articles</span>
          </Link>
          <div className="meta-badge-row">
            <span className={`status-pill status-${post.status}`}>
              {post.status.toUpperCase()}
            </span>
            <span className="slug-badge font-mono">/journal/{post.slug}</span>
          </div>
        </div>

        {/* Dedicated Actions */}
        <div className="preview-actions">
          <Link href={`/admin/blogs/${post.id}/edit`} className="button button-primary">
            <Edit2 size={16} aria-hidden="true" />
            <span>Edit Article</span>
          </Link>
          <Link href={`/admin/blogs/${post.id}/delete`} className="button button-outline text-danger">
            <Trash2 size={16} aria-hidden="true" />
            <span>Delete</span>
          </Link>
        </div>
      </div>

      {/* Styled Storefront Journal Preview Card */}
      <article className="journal-article-card" aria-label="Article content preview">
        {/* Cover Image Banner */}
        {post.cover_image_url && (
          <div className="cover-banner-wrap">
            <Image
              src={post.cover_image_url}
              alt=""
              width={1000}
              height={320}
              sizes="(max-width: 1024px) 100vw, 1000px"
              className="cover-banner-img"
            />
          </div>
        )}

        <div className="article-body-inner">
          <header className="article-header">
            <p className="article-eyebrow">Himalayan Tea House Journal</p>
            <h1 className="article-title">{post.title}</h1>

            <div className="byline-row">
              <span className="byline-item">
                <User size={14} aria-hidden="true" />
                <span>{post.author_name}</span>
              </span>
              <span>·</span>
              <span className="byline-item">
                <Calendar size={14} aria-hidden="true" />
                <span>
                  {post.published_at
                    ? new Date(post.published_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })
                    : "Unpublished Draft"}
                </span>
              </span>
            </div>

            {post.summary && <p className="article-excerpt">{post.summary}</p>}
          </header>

          <hr className="divider" />

          {/* Rendered Markdown Body */}
          <div
            className="rendered-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdownHtml(post.content) }}
          />
        </div>
      </article>

      <style jsx>{`
        .blog-preview-root {
          display: flex;
          flex-direction: column;
          gap: 20px;
          max-width: 900px;
        }

        .preview-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .back-link {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--pine, #23483a);
          margin-bottom: 6px;
          text-decoration: none;
        }

        .meta-badge-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .slug-badge {
          font-size: 11px;
          color: #7b8075;
          background: #ede9df;
          padding: 2px 6px;
          border-radius: 4px;
        }

        .status-pill {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 12px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.04em;
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

        .preview-actions {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .journal-article-card {
          background: #ffffff;
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
        }

        .cover-banner-wrap {
          width: 100%;
          height: 320px;
          background: #ede9df;
          overflow: hidden;
        }

        .cover-banner-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .article-body-inner {
          padding: 36px 40px;
        }

        .article-eyebrow {
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--amber, #b36b3d);
          margin: 0 0 8px;
        }

        .article-title {
          font-size: clamp(28px, 4vw, 40px);
          font-family: Georgia, serif;
          color: var(--forest, #1d2a24);
          line-height: 1.25;
          margin: 0 0 16px;
        }

        .byline-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #7b8075;
          margin-bottom: 18px;
        }

        .byline-item {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .article-excerpt {
          font-size: 17px;
          line-height: 1.6;
          color: #555850;
          font-style: italic;
          margin: 0;
        }

        .divider {
          border: none;
          height: 1px;
          background: #ede9df;
          margin: 28px 0;
        }

        .rendered-body {
          font-family: Georgia, serif;
          line-height: 1.8;
          font-size: 16px;
          color: var(--ink, #171713);
        }

        :global(.journal-h1) {
          font-size: 28px;
          margin: 32px 0 16px;
          color: var(--forest, #1d2a24);
        }

        :global(.journal-h2) {
          font-size: 24px;
          margin: 28px 0 14px;
          color: var(--forest, #1d2a24);
        }

        :global(.journal-h3) {
          font-size: 20px;
          margin: 22px 0 10px;
          color: var(--forest, #1d2a24);
        }

        :global(.journal-p) {
          margin: 0 0 20px;
        }

        :global(.journal-quote) {
          border-left: 3px solid #b39156;
          margin: 24px 0;
          padding: 12px 20px;
          background: rgba(179, 145, 86, 0.08);
          font-style: italic;
          color: #4a4d44;
        }

        :global(.journal-li) {
          margin: 6px 0 6px 24px;
        }

        :global(.journal-link) {
          color: var(--pine, #23483a);
          text-decoration: underline;
        }

        .dossier-state-card {
          text-align: center;
          padding: 64px 20px;
          background: var(--paper2, #fbf8f1);
          border: 1px solid var(--admin-border, #d9d4c8);
          border-radius: 8px;
          color: #6a6e64;
        }

        .dossier-state-card.error {
          color: #8f2f2a;
        }

        .dossier-state-card h2 {
          font-family: Georgia, serif;
          margin: 12px 0 8px;
        }
      `}</style>
    </div>
  );
}
