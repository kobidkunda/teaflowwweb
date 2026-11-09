"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { Save, Send, Sparkles, Copy, CheckCircle2, AlertCircle, ArrowLeft, Image as ImageIcon } from "lucide-react";
import type { EmailTemplate } from "@/lib/emailTemplates";

interface LogoOption {
  id: number;
  name: string;
  category: string;
  pngUrl: string;
  absoluteUrl: string;
  description: string;
}

interface SmtpInfo {
  configured: boolean;
  host: string | null;
  port: number;
  secure: boolean;
  from: string;
  hasAuth: boolean;
}

export function EmailTemplateEditor({ templateKey }: { templateKey: string }) {
  const [template, setTemplate] = useState<EmailTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [preview, setPreview] = useState<{ subject: string; html: string; text: string } | null>(null);
  const [logos, setLogos] = useState<LogoOption[]>([]);
  const [smtp, setSmtp] = useState<SmtpInfo | null>(null);
  const [showLogos, setShowLogos] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  // Prompt → draft
  const [promptGoal, setPromptGoal] = useState("");
  const [promptTone, setPromptTone] = useState<"warm" | "formal" | "festive" | "minimal">("warm");
  const [promptCta, setPromptCta] = useState("");
  const [generating, setGenerating] = useState(false);

  // Test send
  const [testTo, setTestTo] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const fetchTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${encodeURIComponent(templateKey)}?preview=1`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("load");
      const data = (await res.json()) as { template: EmailTemplate; preview: { subject: string; html: string; text: string } };
      setTemplate(data.template);
      setSubject(data.template.subject);
      setHtmlBody(data.template.html_body);
      setTextBody(data.template.text_body);
      setPreview(data.preview);
    } catch {
      setStatus({ type: "error", text: "Unable to load this email template." });
    } finally {
      setLoading(false);
    }
  }, [templateKey]);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/email-config", { credentials: "same-origin" });
      if (res.ok) {
        const data = (await res.json()) as { smtp: SmtpInfo; logos: LogoOption[] };
        setSmtp(data.smtp);
        setLogos(data.logos || []);
      }
    } catch {
      // non-fatal
    }
  }, []);

  useEffect(() => {
    void fetchTemplate();
    void fetchConfig();
  }, [fetchTemplate, fetchConfig]);

  const insertAtCursor = (field: "html" | "text", snippet: string) => {
    const id = field === "html" ? "email-html-body" : "email-text-body";
    const el = document.getElementById(id) as HTMLTextAreaElement | null;
    if (!el) {
      if (field === "html") setHtmlBody((v) => v + snippet);
      else setTextBody((v) => v + snippet);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? el.value.length;
    const next = el.value.slice(0, start) + snippet + el.value.slice(end);
    if (field === "html") setHtmlBody(next);
    else setTextBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  };

  const copyText = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard unavailable
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (subject.trim().length < 3 || htmlBody.trim().length < 10 || textBody.trim().length < 10) {
      setStatus({ type: "error", text: "Subject and both bodies are required." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/email-templates/${encodeURIComponent(templateKey)}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), html_body: htmlBody, text_body: textBody }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setTemplate(data.template);
        setStatus({ type: "success", text: "Template saved. All future sends use this copy." });
        void refreshPreview();
      } else {
        setStatus({ type: "error", text: data?.error || "Failed to save template." });
      }
    } catch {
      setStatus({ type: "error", text: "Network error saving template." });
    } finally {
      setSaving(false);
    }
  };

  const refreshPreview = async () => {
    try {
      const res = await fetch(`/api/admin/email-templates/${encodeURIComponent(templateKey)}?preview=1`, {
        credentials: "same-origin",
      });
      if (res.ok) {
        const data = (await res.json()) as { preview: { subject: string; html: string; text: string } };
        setPreview(data.preview);
      }
    } catch {
      // ignore
    }
  };

  const handleGenerate = async () => {
    if (promptGoal.trim().length < 8) {
      setStatus({ type: "error", text: "Describe the email goal in a few words first." });
      return;
    }
    setGenerating(true);
    setStatus(null);
    try {
      const res = await fetch("/api/admin/email-templates/generate", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          template_key: templateKey,
          goal: promptGoal.trim(),
          tone: promptTone,
          call_to_action: promptCta.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.draft) {
        setSubject(data.draft.subject);
        setHtmlBody(data.draft.html_body);
        setTextBody(data.draft.text_body);
        setStatus({ type: "success", text: "Draft generated from your prompt — review, then Save." });
      } else {
        setStatus({ type: "error", text: data?.error || "Could not generate a draft." });
      }
    } catch {
      setStatus({ type: "error", text: "Network error generating draft." });
    } finally {
      setGenerating(false);
    }
  };

  const handleTest = async () => {
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRe.test(testTo.trim())) {
      setTestResult("Enter a valid test recipient email.");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(`/api/admin/email-templates/${encodeURIComponent(templateKey)}/test`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.sent) {
        setTestResult("Test email sent — check the inbox (and spam folder).");
      } else {
        setTestResult(data?.reason || "Test send did not deliver. A rendered preview is shown below.");
        if (data?.preview) setPreview(data.preview);
      }
    } catch {
      setTestResult("Network error sending test.");
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <p style={{ padding: 32, color: "#63665e" }}>Loading template…</p>;
  if (!template) return <p role="alert" style={{ color: "#8f2f2a" }}>Email template not found.</p>;

  const inputStyle: React.CSSProperties = {
    width: "100%", padding: "9px 12px", borderRadius: 6, border: "1px solid #d9d4c8", fontSize: 14, boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, marginBottom: 6, color: "#1d2a24" };
  const sectionStyle: React.CSSProperties = { background: "#fff", border: "1px solid #d9d4c8", borderRadius: 8, padding: 20 };

  return (
    <div style={{ maxWidth: 1020 }}>
      <Link href="/admin/emails" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#23483a", marginBottom: 12 }}>
        <ArrowLeft size={15} aria-hidden="true" /> All email templates
      </Link>
      <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 800 }}>{template.label}</h1>
      <p style={{ margin: "0 0 6px", color: "#63665e", fontSize: 14 }}>{template.description}</p>
      <p style={{ margin: "0 0 16px", fontSize: 12, color: "#8c9b88" }}>
        Key <code>{template.key}</code> · Last updated {template.updated_at || "—"}
        {smtp && (smtp.configured
          ? ` · SMTP ${smtp.host}:${smtp.port}${smtp.secure ? " (TLS)" : ""} · from ${smtp.from}`
          : " · SMTP not configured — test sends render a preview")}
      </p>

      {status && (
        <div role={status.type === "error" ? "alert" : "status"} aria-live="polite"
          style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", borderRadius: 6, marginBottom: 16, fontSize: 14, fontWeight: 500,
            background: status.type === "success" ? "rgba(35,72,58,.08)" : "rgba(143,47,42,.08)",
            border: `1px solid ${status.type === "success" ? "#23483a" : "#8f2f2a"}`,
            color: status.type === "success" ? "#23483a" : "#8f2f2a" }}>
          {status.type === "success" ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{status.text}</span>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 16 }}>
        {/* Prompt → draft */}
        <section aria-label="Generate from prompt" style={sectionStyle}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800, display: "flex", alignItems: "center", gap: 8 }}>
            <Sparkles size={17} aria-hidden="true" /> Prompt to generate
          </h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#63665e" }}>
            Describe the email goal — the generator drafts on-brand subject + HTML + text using your store name,
            support email, and logo reference. The same copy contract is available to agents as the MCP{" "}
            <code>email-template-composer</code> prompt.
          </p>
          <label htmlFor="email-prompt-goal" style={labelStyle}>What should this email say?</label>
          <textarea
            id="email-prompt-goal"
            value={promptGoal}
            onChange={(e) => setPromptGoal(e.target.value)}
            placeholder="e.g. Festive Diwali greeting announcing First Flush arrival with 15% off and a shop-now CTA"
            rows={3}
            maxLength={2000}
            style={{ ...inputStyle, resize: "vertical" }}
          />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginTop: 12 }}>
            <div>
              <label htmlFor="email-prompt-tone" style={labelStyle}>Tone</label>
              <select id="email-prompt-tone" value={promptTone} onChange={(e) => setPromptTone(e.target.value as typeof promptTone)} style={inputStyle}>
                <option value="warm">Warm</option>
                <option value="formal">Formal</option>
                <option value="festive">Festive</option>
                <option value="minimal">Minimal</option>
              </select>
            </div>
            <div>
              <label htmlFor="email-prompt-cta" style={labelStyle}>Call to action (optional)</label>
              <input id="email-prompt-cta" value={promptCta} onChange={(e) => setPromptCta(e.target.value)} placeholder="Shop the harvest → {{support_email}}" maxLength={200} style={inputStyle} />
            </div>
          </div>
          <button type="button" onClick={() => void handleGenerate()} disabled={generating}
            style={{ marginTop: 12, display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 6, border: 0, background: "#1d2a24", color: "#fff", fontSize: 14, fontWeight: 700, cursor: generating ? "wait" : "pointer", opacity: generating ? 0.7 : 1 }}>
            <Sparkles size={16} aria-hidden="true" /> {generating ? "Generating…" : "Generate draft"}
          </button>
        </section>

        {/* Editor */}
        <form onSubmit={(e) => void handleSave(e)} style={sectionStyle} aria-label="Template content">
          <h2 style={{ margin: "0 0 12px", fontSize: 16, fontWeight: 800 }}>Template content</h2>
          <div style={{ marginBottom: 14 }}>
            <span id="email-vars-label" style={labelStyle}>Variables — select to insert at cursor</span>
            <div role="group" aria-labelledby="email-vars-label" style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {template.variables.map((v) => (
                <span key={v} style={{ display: "inline-flex", gap: 4 }}>
                  <button type="button" onClick={() => insertAtCursor("html", `{{${v}}}`)} title={`Insert {{${v}}} into HTML`}
                    style={{ fontSize: 12, fontWeight: 600, padding: "5px 10px", borderRadius: 20, border: "1px solid #b39156", background: "#fbf8f1", cursor: "pointer" }}>
                    {"{{"}{v}{"}}"}
                  </button>
                  <button type="button" onClick={() => copyText(v, `{{${v}}}`)} aria-label={`Copy {{${v}}}`}
                    style={{ fontSize: 11, padding: "5px 8px", borderRadius: 20, border: "1px solid #d9d4c8", background: "#fff", cursor: "pointer" }}>
                    {copied === v ? "✓" : <Copy size={12} aria-hidden="true" />}
                  </button>
                </span>
              ))}
              <button type="button" onClick={() => setShowLogos((s) => !s)} aria-expanded={showLogos}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 700, padding: "5px 12px", borderRadius: 20, border: "1px solid #23483a", background: "#23483a", color: "#fff", cursor: "pointer" }}>
                <ImageIcon size={13} aria-hidden="true" /> {showLogos ? "Hide logos" : "Logo references"}
              </button>
            </div>
          </div>

          {showLogos && (
            <div style={{ border: "1px solid #d9d4c8", borderRadius: 8, padding: 14, marginBottom: 16, background: "#fbf8f1" }} role="dialog" aria-label="Brand logo references">
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "#63665e" }}>
                Pick the lockup that suits the email canvas — <strong>08 Light Forest Green</strong> reads best on
                cream. Selecting inserts an absolute-URL <code>&lt;img&gt;</code> at the cursor.
              </p>
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(150px,1fr))", gap: 10, maxHeight: 320, overflowY: "auto" }}>
                {logos.map((l) => (
                  <li key={l.id} style={{ background: "#fff", border: "1px solid #d9d4c8", borderRadius: 8, padding: 10, textAlign: "center" }}>
                    <span style={{ display: "block", height: 56, position: "relative", marginBottom: 6, background: "#f6f1e7", borderRadius: 6, overflow: "hidden" }}>
                      <Image src={l.pngUrl} alt={l.name} fill sizes="150px" style={{ objectFit: "contain" }} loading="lazy" />
                    </span>
                    <span style={{ display: "block", fontSize: 11, fontWeight: 700 }}>{l.name}</span>
                    <span style={{ display: "block", fontSize: 10, color: "#8c9b88", marginBottom: 6 }}>{l.category}</span>
                    <button type="button"
                      onClick={() => insertAtCursor("html", `<img src="${l.absoluteUrl}" alt="{{store_name}} logo" width="120" style="max-width:120px"/>`)}
                      style={{ fontSize: 11, fontWeight: 700, padding: "5px 10px", borderRadius: 6, border: "1px solid #23483a", background: "#fff", color: "#23483a", cursor: "pointer" }}>
                      Insert
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginBottom: 14 }}>
            <label htmlFor="email-subject" style={labelStyle}>Subject *</label>
            <input id="email-subject" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} required style={inputStyle} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="email-html-body" style={labelStyle}>HTML body *</label>
            <textarea id="email-html-body" value={htmlBody} onChange={(e) => setHtmlBody(e.target.value)} rows={12} required
              style={{ ...inputStyle, fontFamily: "ui-monospace,monospace", fontSize: 13, resize: "vertical" }} />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label htmlFor="email-text-body" style={labelStyle}>Plain-text body *</label>
            <textarea id="email-text-body" value={textBody} onChange={(e) => setTextBody(e.target.value)} rows={8} required
              style={{ ...inputStyle, fontFamily: "ui-monospace,monospace", fontSize: 13, resize: "vertical" }} />
          </div>
          <button type="submit" disabled={saving}
            style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRadius: 6, border: 0, background: "#b39156", color: "#1d2a24", fontSize: 14, fontWeight: 800, cursor: saving ? "wait" : "pointer", opacity: saving ? 0.7 : 1 }}>
            <Save size={16} aria-hidden="true" /> {saving ? "Saving…" : "Save template"}
          </button>
        </form>

        {/* Preview + test */}
        <section aria-label="Preview and test" style={sectionStyle}>
          <h2 style={{ margin: "0 0 4px", fontSize: 16, fontWeight: 800 }}>Preview &amp; test send</h2>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#63665e" }}>
            Preview renders with sample data. Test sends deliver through the same SMTP relay the MCP{" "}
            <code>email.sendTest</code> tool uses — per the configured conf (host, port, from address).
          </p>
          {preview && (
            <div style={{ display: "grid", gap: 12, marginBottom: 16 }}>
              <div style={{ border: "1px solid #d9d4c8", borderRadius: 8, overflow: "hidden" }}>
                <p style={{ margin: 0, padding: "8px 12px", background: "#ede9df", fontSize: 13, fontWeight: 700 }}>Subject: {preview.subject}</p>
                <div aria-label="HTML preview" dangerouslySetInnerHTML={{ __html: preview.html }} style={{ padding: 16, background: "#fffdf8" }} />
              </div>
              <details>
                <summary style={{ fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Plain-text version</summary>
                <pre style={{ whiteSpace: "pre-wrap", fontSize: 12, background: "#f6f1e7", padding: 12, borderRadius: 6 }}>{preview.text}</pre>
              </details>
            </div>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
            <div style={{ flex: "1 1 240px" }}>
              <label htmlFor="email-test-to" style={labelStyle}>Send test to</label>
              <input id="email-test-to" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)}
                placeholder="you@example.com" maxLength={254} style={inputStyle} autoComplete="email" />
            </div>
            <button type="button" onClick={() => void handleTest()} disabled={testing}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 6, border: "1px solid #23483a", background: "#fff", color: "#23483a", fontSize: 14, fontWeight: 700, cursor: testing ? "wait" : "pointer" }}>
              <Send size={15} aria-hidden="true" /> {testing ? "Sending…" : "Send test"}
            </button>
          </div>
          {testResult && <p role="status" style={{ marginTop: 10, fontSize: 13, color: "#23483a" }}>{testResult}</p>}
        </section>
      </div>
    </div>
  );
}
