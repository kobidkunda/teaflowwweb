"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Mail, Search, RefreshCw, ArrowRight } from "lucide-react";
import { AdminAuthGate } from "@/components/admin/catalog/AdminAuthGate";
import type { EmailTemplate } from "@/lib/emailTemplates";

export default function AdminEmailsPage() {
  return (
    <AdminAuthGate>
      <EmailsListContent />
    </AdminAuthGate>
  );
}

function EmailsListContent() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [smtpNote, setSmtpNote] = useState<string | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [tRes, cRes] = await Promise.all([
        fetch("/api/admin/email-templates", { credentials: "same-origin" }),
        fetch("/api/admin/email-config", { credentials: "same-origin" }),
      ]);
      if (!tRes.ok) throw new Error("templates");
      const tData = (await tRes.json()) as { templates: EmailTemplate[] };
      setTemplates(tData.templates || []);
      if (cRes.ok) {
        const cData = (await cRes.json()) as { smtp?: { configured: boolean; from: string } };
        setSmtpNote(
          cData.smtp?.configured
            ? `SMTP relay configured · test sends deliver from ${cData.smtp.from}.`
            : "SMTP is not configured — test sends render a preview instead of delivering."
        );
      }
    } catch {
      setError("Unable to retrieve email templates. Check network connection.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAll();
  }, []);

  const filtered = templates.filter(
    (t) =>
      !search.trim() ||
      t.key.toLowerCase().includes(search.toLowerCase()) ||
      t.label.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ maxWidth: 960 }}>
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 11, letterSpacing: ".14em", color: "#8c9b88", fontWeight: 700, margin: "0 0 4px" }}>
          SETTINGS · COMMUNICATIONS
        </p>
        <h1 style={{ margin: "0 0 6px", fontSize: 28, fontWeight: 800 }}>Email templates</h1>
        <p style={{ margin: 0, color: "#63665e", fontSize: 14 }}>
          One editor for every email the store sends — password resets, order updates, contact and wholesale
          acknowledgements, newsletter welcome, and cart recovery. Each template supports{" "}
          <code>{"{{variables}}"}</code>, brand logo references, prompt-assisted drafts, and test sends through
          the configured SMTP relay.
        </p>
      </div>

      {smtpNote && (
        <p role="status" style={{ fontSize: 13, color: "#23483a", background: "rgba(35,72,58,.07)", border: "1px solid #23483a", borderRadius: 6, padding: "8px 12px" }}>
          {smtpNote}
        </p>
      )}

      <div style={{ display: "flex", gap: 10, margin: "16px 0" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={16} aria-hidden="true" style={{ position: "absolute", left: 10, top: 11, color: "#8c9b88" }} />
          <input
            type="search"
            aria-label="Search email templates"
            placeholder="Search templates…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: "100%", padding: "9px 12px 9px 34px", borderRadius: 6, border: "1px solid #d9d4c8", fontSize: 14, boxSizing: "border-box" }}
          />
        </div>
        <button
          type="button"
          onClick={() => void fetchAll()}
          style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 14px", borderRadius: 6, border: "1px solid #d9d4c8", background: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <RefreshCw size={15} aria-hidden="true" /> Refresh
        </button>
      </div>

      {loading ? (
        <p style={{ padding: 32, textAlign: "center", color: "#63665e" }}>Loading email templates…</p>
      ) : error ? (
        <p role="alert" style={{ color: "#8f2f2a" }}>{error}</p>
      ) : filtered.length === 0 ? (
        <p style={{ padding: 32, textAlign: "center", color: "#63665e", border: "1px dashed #d9d4c8", borderRadius: 8 }}>
          No email templates match your search.
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((t) => (
            <li key={t.key} style={{ background: "#fff", border: "1px solid #d9d4c8", borderRadius: 8, padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
              <span aria-hidden="true" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 38, height: 38, borderRadius: 8, background: "#1d2a24", color: "#e8c87a", flexShrink: 0 }}>
                <Mail size={18} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ fontSize: 15 }}>{t.label}</strong>
                  <code style={{ fontSize: 11, color: "#63665e" }}>{t.key}</code>
                </div>
                <p style={{ margin: "4px 0", fontSize: 13, color: "#63665e" }}>{t.description}</p>
                <p style={{ margin: "4px 0 0", fontSize: 12, color: "#8c9b88" }}>
                  Subject: {t.subject} · Variables: {t.variables.join(", ") || "—"}
                </p>
              </div>
              <Link
                href={`/admin/emails/${encodeURIComponent(t.key)}`}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#23483a", whiteSpace: "nowrap" }}
              >
                Edit <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
