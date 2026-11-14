"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";
import {
  EVENT_LABELS,
  NOTIFICATION_EVENT_TYPES,
  type NotificationEventType,
} from "@/lib/notifications/events";

interface ResponseItem {
  id: string;
  entityType: NotificationEventType;
  reference: string;
  customerName: string;
  email: string | null;
  phone: string | null;
  summary: string;
  status: string;
  createdAt: string;
  deepLink: string | null;
  payload: Record<string, unknown>;
}

interface ConversationEntry {
  id: string;
  entry_type: "note" | "reply_email" | "customer_feedback" | "status_change";
  author: string;
  message: string;
  metadata_json: string | null;
  created_at: string;
}

interface DeliveryRow {
  id: string;
  event_type: string;
  channel: "email" | "webhook";
  target: string;
  status: "queued" | "sent" | "failed";
  http_status: number | null;
  last_error: string | null;
  created_at: string;
}

const STATUS_OPTIONS = ["new", "in_progress", "replied", "quoted", "resolved", "archived"] as const;

const STATUS_BADGE_COLORS: Record<string, { bg: string; color: string }> = {
  new: { bg: "#fef3c7", color: "#92400e" },
  in_progress: { bg: "#dbeafe", color: "#1e40af" },
  replied: { bg: "#e0e7ff", color: "#3730a3" },
  quoted: { bg: "#ede9fe", color: "#5b21b6" },
  resolved: { bg: "#dcfce7", color: "#166534" },
  archived: { bg: "#f3f4f6", color: "#4b5563" },
};

function formatValue(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "string" || typeof val === "number" || typeof val === "boolean") {
    return String(val);
  }
  try {
    return JSON.stringify(val, null, 2);
  } catch {
    return String(val);
  }
}

export function AdminResponsesInbox() {
  const [activeType, setActiveType] = useState<NotificationEventType | "all">("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<ResponseItem[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selected, setSelected] = useState<ResponseItem | null>(null);
  const [conversation, setConversation] = useState<ConversationEntry[]>([]);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const [newStatus, setNewStatus] = useState<string>("new");
  const [savingStatus, setSavingStatus] = useState(false);
  const [entryType, setEntryType] = useState<"note" | "customer_feedback" | "reply_email">("note");
  const [entryMessage, setEntryMessage] = useState("");
  const [replySubject, setReplySubject] = useState("");
  const [savingEntry, setSavingEntry] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        type: activeType,
        status: statusFilter,
        q: searchQuery.trim(),
        limit: "80",
      });
      const res = await fetch(`/api/admin/responses?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Failed to load responses.");
      const data = (await res.json()) as { items: ResponseItem[]; counts: Record<string, number> };
      setItems(data.items || []);
      setCounts(data.counts || {});
    } catch {
      setError("Unable to load responses from the server.");
    } finally {
      setLoading(false);
    }
  }, [activeType, statusFilter, searchQuery]);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  const openDetail = async (item: ResponseItem) => {
    setSelected(item);
    setNewStatus(item.status);
    setActionNotice(null);
    setDetailLoading(true);
    setReplySubject(`Re: ${EVENT_LABELS[item.entityType]} (${item.reference})`);
    try {
      const res = await fetch(
        `/api/admin/responses/${encodeURIComponent(item.entityType)}/${encodeURIComponent(item.id)}`,
        { credentials: "same-origin" }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          item: ResponseItem;
          conversation: ConversationEntry[];
          deliveries: DeliveryRow[];
        };
        if (data.item) {
          setSelected(data.item);
          setNewStatus(data.item.status);
        }
        setConversation(data.conversation || []);
        setDeliveries(data.deliveries || []);
      }
    } finally {
      setDetailLoading(false);
    }
  };

  const handleStatusUpdate = async () => {
    if (!selected) return;
    setSavingStatus(true);
    setActionNotice(null);
    try {
      const res = await fetch(
        `/api/admin/responses/${encodeURIComponent(selected.entityType)}/${encodeURIComponent(selected.id)}`,
        {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus }),
        }
      );
      if (res.ok) {
        const data = (await res.json()) as {
          item: ResponseItem;
          conversation: ConversationEntry[];
          deliveries: DeliveryRow[];
        };
        if (data.item) setSelected(data.item);
        setConversation(data.conversation || []);
        setActionNotice(`Status updated to "${newStatus}".`);
        void fetchList();
      }
    } finally {
      setSavingStatus(false);
    }
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected || !entryMessage.trim()) return;
    setSavingEntry(true);
    setActionNotice(null);
    try {
      const res = await fetch(
        `/api/admin/responses/${encodeURIComponent(selected.entityType)}/${encodeURIComponent(selected.id)}/conversation`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            entryType,
            message: entryMessage.trim(),
            sendEmailTo: entryType === "reply_email" ? selected.email : null,
            subject: entryType === "reply_email" ? replySubject : undefined,
          }),
        }
      );
      const data = await res.json().catch(() => null);
      if (res.ok && data?.entry) {
        setConversation((prev) => [...prev, data.entry]);
        setEntryMessage("");
        setActionNotice(
          entryType === "reply_email"
            ? data.emailSent
              ? `Email reply sent to ${selected.email} and logged.`
              : "Reply logged in thread (SMTP not configured or email skipped)."
            : "Conversation entry saved."
        );
        void fetchList();
      } else {
        setActionNotice(data?.error || "Failed to save conversation entry.");
      }
    } finally {
      setSavingEntry(false);
    }
  };

  return (
    <div style={{ maxWidth: "1320px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "20px" }}>
        <div>
          <h1 style={{ margin: "0 0 6px 0", fontSize: "26px", fontWeight: 700, display: "flex", alignItems: "center", gap: "10px" }}>
            <MessageSquare size={24} /> Responses &amp; Conversations Inbox
          </h1>
          <p style={{ margin: 0, color: "#63665e", fontSize: "14px" }}>
            All form submissions, bulk enquiries, lead captures, newsletter signups, private-label requests, quotes, orders, and subscriptions with status &amp; conversation tracking.
          </p>
        </div>
        <button type="button" onClick={() => void fetchList()} className="button button-outline" style={{ fontSize: "13px" }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Category Tabs */}
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "16px" }}>
        <button
          type="button"
          onClick={() => setActiveType("all")}
          className={`button ${activeType === "all" ? "button-primary" : "button-outline"}`}
          style={{ fontSize: "12px", padding: "7px 12px" }}
        >
          All ({counts.all ?? 0})
        </button>
        {NOTIFICATION_EVENT_TYPES.map((evt) => (
          <button
            key={evt}
            type="button"
            onClick={() => setActiveType(evt)}
            className={`button ${activeType === evt ? "button-primary" : "button-outline"}`}
            style={{ fontSize: "12px", padding: "7px 12px" }}
          >
            {EVENT_LABELS[evt]} ({counts[evt] ?? 0})
          </button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "16px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 260px", maxWidth: "400px" }}>
          <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#6b7068" }} />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name, email, phone, reference..."
            style={{ width: "100%", padding: "8px 12px 8px 32px", borderRadius: "6px", border: "1px solid #d9d4c8", fontSize: "13px", boxSizing: "border-box" }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid #d9d4c8", fontSize: "13px", background: "#fff" }}
        >
          <option value="all">All Statuses</option>
          {STATUS_OPTIONS.map((st) => (
            <option key={st} value={st}>
              {st}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div style={{ padding: "12px 16px", borderRadius: "8px", background: "#fff0f0", color: "#8f2f2a", border: "1px solid #8f2f2a", marginBottom: "16px", fontSize: "13px" }}>
          <AlertCircle size={15} style={{ verticalAlign: "middle", marginRight: "6px" }} />
          {error}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: selected ? "minmax(0, 1.2fr) minmax(360px, 1fr)" : "1fr", gap: "20px", alignItems: "start" }}>
        {/* Table */}
        <div style={{ overflowX: "auto", background: "#fff", borderRadius: "8px", border: "1px solid #d9d4c8" }}>
          <table className="admin-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Reference</th>
                <th>Contact</th>
                <th>Summary</th>
                <th>Status</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#63665e" }}>
                    Loading responses...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "#63665e" }}>
                    No responses match the current filter.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const badge = STATUS_BADGE_COLORS[item.status] || { bg: "#ede9df", color: "#1d2a24" };
                  const isSelected = selected?.id === item.id && selected?.entityType === item.entityType;
                  return (
                    <tr
                      key={`${item.entityType}:${item.id}`}
                      onClick={() => void openDetail(item)}
                      style={{
                        cursor: "pointer",
                        background: isSelected ? "#eef5ed" : undefined,
                      }}
                    >
                      <td style={{ fontSize: "12px", fontWeight: 600 }}>{EVENT_LABELS[item.entityType]}</td>
                      <td style={{ fontFamily: "monospace", fontSize: "12px" }}>{item.reference}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.customerName}</div>
                        <div style={{ fontSize: "12px", color: "#63665e" }}>
                          {[item.email, item.phone].filter(Boolean).join(" · ") || "—"}
                        </div>
                      </td>
                      <td style={{ maxWidth: "260px", fontSize: "12px" }}>{item.summary}</td>
                      <td>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 8px",
                            borderRadius: "999px",
                            fontSize: "11px",
                            fontWeight: 600,
                            background: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td style={{ fontSize: "12px", whiteSpace: "nowrap", color: "#63665e" }}>
                        {item.createdAt.slice(0, 16).replace("T", " ")}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Detail & Conversation Panel */}
        {selected && (
          <div style={{ background: "#fff", borderRadius: "10px", border: "1px solid #d9d4c8", padding: "20px", position: "sticky", top: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px" }}>
              <div>
                <div style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#23483a" }}>
                  {EVENT_LABELS[selected.entityType]}
                </div>
                <h2 style={{ margin: "2px 0 0", fontSize: "18px", fontWeight: 700 }}>
                  {selected.customerName} <span style={{ fontFamily: "monospace", fontSize: "13px", color: "#63665e" }}>({selected.reference})</span>
                </h2>
              </div>
              <button
                type="button"
                aria-label="Close detail panel"
                onClick={() => setSelected(null)}
                style={{ background: "transparent", border: "none", cursor: "pointer", padding: "4px" }}
              >
                <X size={18} />
              </button>
            </div>

            {selected.deepLink && (
              <div style={{ marginBottom: "12px" }}>
                <a href={selected.deepLink} className="button button-outline" style={{ fontSize: "12px", padding: "5px 10px", display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  Open Full Management Page <ExternalLink size={12} />
                </a>
              </div>
            )}

            {/* Status Update */}
            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "16px", padding: "10px", background: "#fbf8f1", borderRadius: "6px", border: "1px solid #ede9df" }}>
              <label htmlFor="resp-status" style={{ fontSize: "12px", fontWeight: 600 }}>Status:</label>
              <select
                id="resp-status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                style={{ flex: 1, padding: "6px 8px", borderRadius: "6px", border: "1px solid #d9d4c8", fontSize: "13px", background: "#fff" }}
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </select>
              <button
                type="button"
                disabled={savingStatus}
                onClick={() => void handleStatusUpdate()}
                className="button button-primary"
                style={{ fontSize: "12px", padding: "6px 12px" }}
              >
                {savingStatus ? "Saving..." : "Update"}
              </button>
            </div>

            {actionNotice && (
              <div style={{ marginBottom: "12px", padding: "8px 12px", borderRadius: "6px", background: "#eef5ed", color: "#23483a", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                <CheckCircle2 size={14} /> {actionNotice}
              </div>
            )}

            {/* Submitted Values */}
            <h3 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", color: "#46524a" }}>
              Submitted Values
            </h3>
            <div style={{ maxHeight: "220px", overflowY: "auto", border: "1px solid #ede9df", borderRadius: "6px", marginBottom: "16px" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <tbody>
                  {Object.entries(selected.payload).map(([k, v]) => (
                    <tr key={k} style={{ borderBottom: "1px solid #f2efe7" }}>
                      <td style={{ padding: "6px 8px", fontWeight: 600, color: "#1d2a24", width: "36%", verticalAlign: "top" }}>{k}</td>
                      <td style={{ padding: "6px 8px", color: "#46524a", whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{formatValue(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Conversation & Feedback Thread */}
            <h3 style={{ margin: "0 0 8px", fontSize: "13px", fontWeight: 700, textTransform: "uppercase", color: "#46524a" }}>
              Conversation &amp; Feedback
            </h3>
            <div style={{ maxHeight: "220px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
              {detailLoading ? (
                <div style={{ fontSize: "12px", color: "#63665e" }}>Loading thread...</div>
              ) : conversation.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#63665e", padding: "10px", background: "#faf8f3", borderRadius: "6px" }}>
                  No notes, replies, or customer feedback logged yet.
                </div>
              ) : (
                conversation.map((entry) => (
                  <div key={entry.id} style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #ede9df", background: entry.entry_type === "reply_email" ? "#f4f7f4" : "#faf8f3", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 600, marginBottom: "4px", color: "#23483a" }}>
                      <span>{entry.entry_type.replace("_", " ")} · {entry.author}</span>
                      <span style={{ fontWeight: 400, color: "#6b7068" }}>{entry.created_at.slice(0, 16).replace("T", " ")}</span>
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", color: "#1d2a24" }}>{entry.message}</div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={(e) => void handleAddEntry(e)} style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              <div style={{ display: "flex", gap: "8px" }}>
                <select
                  value={entryType}
                  onChange={(e) => setEntryType(e.target.value as typeof entryType)}
                  style={{ padding: "7px 8px", borderRadius: "6px", border: "1px solid #d9d4c8", fontSize: "12px", background: "#fff" }}
                >
                  <option value="note">Internal Note</option>
                  <option value="customer_feedback">Log Customer Feedback</option>
                  {selected.email && <option value="reply_email">Send Email Reply ({selected.email})</option>}
                </select>
              </div>
              {entryType === "reply_email" && (
                <input
                  type="text"
                  value={replySubject}
                  onChange={(e) => setReplySubject(e.target.value)}
                  placeholder="Email Subject"
                  style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #d9d4c8", fontSize: "12px" }}
                />
              )}
              <textarea
                rows={3}
                value={entryMessage}
                onChange={(e) => setEntryMessage(e.target.value)}
                placeholder="Write a staff note, log WhatsApp/call feedback, or compose an email reply..."
                style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #d9d4c8", fontSize: "13px", resize: "vertical" }}
              />
              <button
                type="submit"
                disabled={savingEntry || !entryMessage.trim()}
                className="button button-primary"
                style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
              >
                <Send size={13} /> {savingEntry ? "Saving..." : entryType === "reply_email" ? "Send Email & Log" : "Save Entry"}
              </button>
            </form>

            {/* Recent Notification Deliveries for this Event Type */}
            {deliveries.length > 0 && (
              <div>
                <h3 style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: 700, textTransform: "uppercase", color: "#46524a" }}>
                  Recent {selected.entityType} Alert Deliveries
                </h3>
                <div style={{ fontSize: "11px", border: "1px solid #ede9df", borderRadius: "6px", overflow: "hidden" }}>
                  {deliveries.slice(0, 5).map((d) => (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "5px 8px", borderBottom: "1px solid #f2efe7" }}>
                      <span>{d.channel}: {d.target}</span>
                      <span style={{ fontWeight: 600, color: d.status === "sent" ? "#166534" : d.status === "failed" ? "#8f2f2a" : "#92400e" }}>
                        {d.status}{d.http_status ? ` (${d.http_status})` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
