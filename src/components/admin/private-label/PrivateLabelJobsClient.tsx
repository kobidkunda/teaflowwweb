"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Search,
  RefreshCw,
  ShieldCheck,
  X,
  PlusCircle,
} from "lucide-react";
import { ReleaseJobModal } from "./ReleaseJobModal";

interface QCMilestone {
  id: string;
  milestone_name: string;
  stage: string;
  status: "pending" | "passed" | "failed" | "waived";
  inspector_name: string | null;
  inspection_date: string | null;
  evidence_notes: string | null;
}

interface ProductionJob {
  id: string;
  job_number: string;
  order_id: string;
  order_number?: string;
  company_name?: string;
  status: string;
  target_completion_date: string | null;
  actual_completion_date: string | null;
  operator_notes: string | null;
  passed_qc_count?: number;
  milestones: QCMilestone[];
  created_at: string;
}

export function PrivateLabelJobsClient() {
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  // Release Job Modal
  const [releaseModalOpen, setReleaseModalOpen] = useState(false);

  // QC Inspection Modal
  const [inspectingJob, setInspectingJob] = useState<ProductionJob | null>(null);
  const [selectedMilestone, setSelectedMilestone] = useState<QCMilestone | null>(null);
  const [inspectorName, setInspectorName] = useState("");
  const [milestoneStatus, setMilestoneStatus] = useState<"passed" | "failed" | "waived">("passed");
  const [evidenceNotes, setEvidenceNotes] = useState("");
  const [cuppingScore, setCuppingScore] = useState("");
  const [recordedWeight, setRecordedWeight] = useState("");
  const [targetWeight, setTargetWeight] = useState("");
  const [submittingQC, setSubmittingQC] = useState(false);
  const [qcModalError, setQcModalError] = useState<string | null>(null);

  const qcDialogRef = useRef<HTMLDivElement>(null);
  const qcPreviousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!inspectingJob) {
      setQcModalError(null);
      return;
    }

    qcPreviousActiveElement.current = document.activeElement as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setInspectingJob(null);
        return;
      }

      // Focus trap
      if (e.key === "Tab" && qcDialogRef.current) {
        const focusable = qcDialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Initial focus into QC modal
    setTimeout(() => {
      if (qcDialogRef.current) {
        const first = qcDialogRef.current.querySelector<HTMLElement>("input, select, textarea, button");
        first?.focus();
      }
    }, 50);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (qcPreviousActiveElement.current) {
        qcPreviousActiveElement.current.focus();
      }
    };
  }, [inspectingJob]);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/v1/admin/private-label/jobs?status=${statusFilter}&search=${encodeURIComponent(search)}&limit=100`
      );
      const data = await res.json();
      setJobs(data.jobs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching jobs");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, search]);

  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  const handleOpenQCModal = (job: ProductionJob) => {
    setInspectingJob(job);
    setSelectedMilestone(job.milestones[0] || null);
    setInspectorName("Quality Team Siliguri");
    setMilestoneStatus("passed");
    setEvidenceNotes("");
    setCuppingScore("");
    setRecordedWeight("");
    setTargetWeight("");
    setQcModalError(null);
  };

  const handleSaveMilestone = async () => {
    if (!inspectingJob || !selectedMilestone) return;
    if (!inspectorName.trim()) {
      setQcModalError("Inspector name is required.");
      return;
    }
    setSubmittingQC(true);
    setQcModalError(null);
    try {
      const body: Record<string, unknown> = {
        stage: selectedMilestone.stage,
        status: milestoneStatus,
        inspector_name: inspectorName.trim(),
        evidence_notes: evidenceNotes.trim() || undefined,
      };

      if (selectedMilestone.stage === "fill_weight") {
        if (recordedWeight) body.recorded_weight_g = parseFloat(recordedWeight);
        if (targetWeight) body.target_weight_g = parseFloat(targetWeight);
      }
      if (selectedMilestone.stage === "sensory_cupping" && cuppingScore) {
        body.cupping_score = parseFloat(cuppingScore);
      }

      const res = await fetch(`/api/v1/admin/private-label/jobs/${inspectingJob.id}/qc`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.blockers && Array.isArray(data.blockers)) {
          throw new Error(`QC Gate Blocker: ${data.blockers.join("; ")}`);
        }
        throw new Error(data.error || "Failed to record QC milestone.");
      }

      setInspectingJob(null);
      void fetchJobs();
    } catch (err) {
      setQcModalError(err instanceof Error ? err.message : "QC update failed");
    } finally {
      setSubmittingQC(false);
    }
  };

  const handleAdvanceStatus = async (jobId: string, nextStatus: string) => {
    try {
      setError(null);
      const res = await fetch(`/api/v1/admin/private-label/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.blockers) {
          setError(`QC Completion Gate Blocked: ${data.blockers.join("; ")}`);
        } else {
          setError(data.error || "Failed to advance job status");
        }
        return;
      }
      void fetchJobs();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status update failed");
    }
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1440, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, flexWrap: "wrap", gap: 16 }}>
        <div>
          <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6a6e64", fontWeight: 600 }}>
            Private Label Studio
          </span>
          <h1 style={{ margin: "4px 0", fontSize: 28, fontWeight: 700, color: "var(--forest, #1d2a24)", fontFamily: "var(--font-serif, Georgia, serif)" }}>
            Production Pipeline &amp; QC
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#555850" }}>
            Track released manufacturing batches, enforce release gates, and record 7-stage quality milestones.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            data-testid="open-release-job-btn"
            onClick={() => setReleaseModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 6,
              border: "none",
              background: "#23483a",
              color: "#ffffff",
              cursor: "pointer",
            }}
          >
            <PlusCircle size={15} />
            <span>Release Order to Production</span>
          </button>

          <button
            type="button"
            onClick={() => void fetchJobs()}
            disabled={loading}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #d9d4c8",
              background: "#ffffff",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" style={{ padding: 12, marginBottom: 16, background: "#fdf2f2", border: "1px solid #f8b4b4", borderRadius: 6, color: "#9b1c1c", fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Filter Strip */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ position: "relative", minWidth: 260 }}>
          <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "#888" }} />
          <input
            type="text"
            placeholder="Search by job #, order #, client..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 34px",
              fontSize: 13,
              borderRadius: 6,
              border: "1px solid #d9d4c8",
              background: "#ffffff",
            }}
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "8px 12px",
            fontSize: 13,
            borderRadius: 6,
            border: "1px solid #d9d4c8",
            background: "#ffffff",
          }}
        >
          <option value="all">All Stages</option>
          <option value="scheduled">Scheduled</option>
          <option value="procurement">Procurement</option>
          <option value="printing">Printing</option>
          <option value="blending">Blending</option>
          <option value="filling_packing">Filling &amp; Packing</option>
          <option value="qc">QC</option>
          <option value="ready_to_ship">Ready to Ship</option>
          <option value="completed">Completed</option>
          <option value="halted">Halted</option>
        </select>
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block" style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#ede9df", textAlign: "left" }}>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Job # &amp; Order</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Client</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Target Date</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Stage Status</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>QC Milestones</th>
              <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => {
              const passedCount = job.milestones.filter((m) => m.status === "passed" || m.status === "waived").length;
              return (
                <tr key={job.id} style={{ borderBottom: "1px solid #f0ece1" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ fontWeight: 600, fontFamily: "monospace", color: "#1d2a24" }}>{job.job_number}</div>
                    <div style={{ fontSize: 11, color: "#6a6e64" }}>Order: {job.order_number || job.order_id}</div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div>{job.company_name || "Enterprise Brand"}</div>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#555" }}>
                    {job.target_completion_date ? new Date(job.target_completion_date).toLocaleDateString() : "TBD"}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        textTransform: "capitalize",
                        background:
                          job.status === "completed"
                            ? "#e8f5e9"
                            : job.status === "halted"
                            ? "#fdf2f2"
                            : "#fff8e1",
                        color:
                          job.status === "completed"
                            ? "#1b5e20"
                            : job.status === "halted"
                            ? "#9b1c1c"
                            : "#8d6000",
                      }}
                    >
                      {job.status.replace("_", " ")}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <button
                      type="button"
                      data-testid="record-qc-btn"
                      onClick={() => handleOpenQCModal(job)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: "3px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: passedCount === 7 ? "#e8f5e9" : "#fff8e1",
                        color: passedCount === 7 ? "#1b5e20" : "#8d6000",
                        border: "1px solid #d9d4c8",
                        cursor: "pointer",
                      }}
                    >
                      <ShieldCheck size={12} />
                      <span data-testid="qc-milestone-tracker">{passedCount}/7 QC Passed</span>
                    </button>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {job.status === "qc" ? (
                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(job.id, "ready_to_ship")}
                        style={{
                          padding: "4px 8px",
                          fontSize: 11,
                          borderRadius: 4,
                          background: "#23483a",
                          color: "#ffffff",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Ready to Ship
                      </button>
                    ) : job.status === "ready_to_ship" ? (
                      <button
                        type="button"
                        onClick={() => handleAdvanceStatus(job.id, "completed")}
                        style={{
                          padding: "4px 8px",
                          fontSize: 11,
                          borderRadius: 4,
                          background: "#1b5e20",
                          color: "#ffffff",
                          border: "none",
                          cursor: "pointer",
                        }}
                      >
                        Mark Completed
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleOpenQCModal(job)}
                        style={{
                          padding: "4px 8px",
                          fontSize: 11,
                          borderRadius: 4,
                          border: "1px solid #d9d4c8",
                          background: "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        Inspect QC
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {jobs.length === 0 && !loading && (
          <div style={{ padding: 24, textAlign: "center", color: "#888" }}>
            No production jobs found matching filters.
          </div>
        )}
      </div>

      {/* Mobile Responsive Cards View */}
      <div className="block md:hidden space-y-3">
        {jobs.map((job) => {
          const passedCount = job.milestones.filter((m) => m.status === "passed" || m.status === "waived").length;
          return (
            <div key={job.id} className="bg-white border border-[#d9d4c8] rounded-xl p-4 shadow-2xs space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-mono font-bold text-sm text-[#1d2a24]">{job.job_number}</div>
                  <div className="text-xs text-[#6a6e64]">Order: {job.order_number || job.order_id}</div>
                  <div className="text-xs font-medium text-[#1d2a24] mt-0.5">{job.company_name || "Enterprise Brand"}</div>
                </div>
                <span
                  style={{
                    display: "inline-block",
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "capitalize",
                    background:
                      job.status === "completed"
                        ? "#e8f5e9"
                        : job.status === "halted"
                        ? "#fdf2f2"
                        : "#fff8e1",
                    color:
                      job.status === "completed"
                        ? "#1b5e20"
                        : job.status === "halted"
                        ? "#9b1c1c"
                        : "#8d6000",
                  }}
                >
                  {job.status.replace("_", " ")}
                </span>
              </div>

              <div className="text-xs text-[#555] flex justify-between">
                <span>Target: {job.target_completion_date ? new Date(job.target_completion_date).toLocaleDateString() : "TBD"}</span>
                <span data-testid="qc-milestone-tracker" className="font-semibold">{passedCount}/7 QC Passed</span>
              </div>

              <div className="pt-2 border-t border-[#f0ece1] flex gap-2">
                <button
                  type="button"
                  data-testid="record-qc-btn"
                  onClick={() => handleOpenQCModal(job)}
                  className="flex-1 py-1.5 px-3 rounded-lg border border-[#d9d4c8] bg-stone-50 text-xs font-semibold text-[#1d2a24] text-center"
                >
                  Inspect 7 QC Stages
                </button>
                {job.status === "qc" && (
                  <button
                    type="button"
                    onClick={() => handleAdvanceStatus(job.id, "ready_to_ship")}
                    className="py-1.5 px-3 rounded-lg bg-[#23483a] text-white text-xs font-semibold"
                  >
                    Ready to Ship
                  </button>
                )}
                {job.status === "ready_to_ship" && (
                  <button
                    type="button"
                    onClick={() => handleAdvanceStatus(job.id, "completed")}
                    className="py-1.5 px-3 rounded-lg bg-[#1b5e20] text-white text-xs font-semibold"
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {jobs.length === 0 && !loading && (
          <div style={{ padding: 24, textAlign: "center", color: "#888", background: "#ffffff", borderRadius: 8 }}>
            No production jobs found matching filters.
          </div>
        )}
      </div>

      {/* QC Inspection Modal */}
      {inspectingJob && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qc-modal-title"
          data-testid="qc-record-modal"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            ref={qcDialogRef}
            style={{
              background: "#ffffff",
              border: "1px solid #d9d4c8",
              borderRadius: 12,
              padding: 24,
              maxWidth: 680,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 id="qc-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1d2a24" }}>
                Cleanroom QC Milestones: Job {inspectingJob.job_number}
              </h3>
              <button
                type="button"
                onClick={() => setInspectingJob(null)}
                aria-label="Close dialog"
                style={{ background: "none", border: "none", cursor: "pointer", padding: 8, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={18} />
              </button>
            </div>

            {qcModalError && (
              <div
                role="alert"
                style={{
                  padding: 12,
                  marginBottom: 16,
                  background: "#fdf2f2",
                  border: "1px solid #f8b4b4",
                  borderRadius: 6,
                  color: "#9b1c1c",
                  fontSize: 13,
                }}
              >
                {qcModalError}
              </div>
            )}

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#444", marginBottom: 6 }}>
                Select Milestone to Inspect:
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {inspectingJob.milestones.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    data-testid="qc-stage-row"
                    onClick={() => setSelectedMilestone(m)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: 4,
                      fontSize: 12,
                      border: selectedMilestone?.id === m.id ? "2px solid #23483a" : "1px solid #d9d4c8",
                      background: m.status === "passed" ? "#e8f5e9" : m.status === "failed" ? "#fdf2f2" : "#fbf8f1",
                      color: m.status === "passed" ? "#1b5e20" : m.status === "failed" ? "#9b1c1c" : "#444",
                      cursor: "pointer",
                      fontWeight: selectedMilestone?.id === m.id ? 700 : 500,
                    }}
                  >
                    {m.milestone_name} ({m.status})
                  </button>
                ))}
              </div>
            </div>

            {selectedMilestone && (
              <div style={{ background: "#fbf8f1", border: "1px solid #ede9df", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12, color: "#1d2a24" }}>
                  Inspecting Stage: <span style={{ textTransform: "capitalize" }}>{selectedMilestone.milestone_name}</span> ({selectedMilestone.stage})
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <div>
                    <label htmlFor="inspector-name-input" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>
                      Inspector Name *
                    </label>
                    <input
                      id="inspector-name-input"
                      type="text"
                      required
                      value={inspectorName}
                      onChange={(e) => setInspectorName(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid #d9d4c8", fontSize: 13 }}
                    />
                  </div>

                  <div>
                    <label htmlFor="milestone-status-select" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>
                      Milestone Result *
                    </label>
                    <select
                      id="milestone-status-select"
                      value={milestoneStatus}
                      onChange={(e) => setMilestoneStatus(e.target.value as "passed" | "failed" | "waived")}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid #d9d4c8", fontSize: 13 }}
                    >
                      <option value="passed">Passed</option>
                      <option value="failed">Failed (HALTS PRODUCTION if Critical)</option>
                      <option value="waived">Waived with Operator Notes</option>
                    </select>
                  </div>
                </div>

                {/* Fill Weight Specific Gate */}
                {selectedMilestone.stage === "fill_weight" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12, background: "#ffffff", padding: 12, borderRadius: 6, border: "1px solid #e2ddd3" }}>
                    <div>
                      <label htmlFor="recorded-weight-input" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>
                        Recorded Weight (g) *
                      </label>
                      <input
                        id="recorded-weight-input"
                        type="number"
                        step="0.01"
                        placeholder="e.g. 100.2"
                        value={recordedWeight}
                        onChange={(e) => setRecordedWeight(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid #d9d4c8", fontSize: 13 }}
                      />
                    </div>
                    <div>
                      <label htmlFor="target-weight-input" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>
                        Target Weight (g) *
                      </label>
                      <input
                        id="target-weight-input"
                        type="number"
                        step="0.01"
                        placeholder="e.g. 100.0"
                        value={targetWeight}
                        onChange={(e) => setTargetWeight(e.target.value)}
                        style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid #d9d4c8", fontSize: 13 }}
                      />
                    </div>
                    <div style={{ gridColumn: "1 / -1", fontSize: 11, color: "#6a6e64" }}>
                      * FSSAI Net Quantity compliance requires actual weight to be within &plusmn;1.5% of target specification.
                    </div>
                  </div>
                )}

                {/* Sensory Cupping Specific Gate */}
                {selectedMilestone.stage === "sensory_cupping" && (
                  <div style={{ marginBottom: 12, background: "#ffffff", padding: 12, borderRadius: 6, border: "1px solid #e2ddd3" }}>
                    <label htmlFor="cupping-score-input" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>
                      Master Taster Cupping Score (0 - 100)
                    </label>
                    <input
                      id="cupping-score-input"
                      type="number"
                      step="0.5"
                      placeholder="e.g. 88.5"
                      value={cuppingScore}
                      onChange={(e) => setCuppingScore(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid #d9d4c8", fontSize: 13 }}
                    />
                  </div>
                )}

                <div>
                  <label htmlFor="evidence-notes-input" style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 4 }}>
                    Inspection Evidence &amp; Batch Notes:
                  </label>
                  <textarea
                    id="evidence-notes-input"
                    rows={2}
                    value={evidenceNotes}
                    onChange={(e) => setEvidenceNotes(e.target.value)}
                    placeholder="Moisture analysis < 6.5%, seal tensile strength confirmed, nitrogen residual < 1%..."
                    style={{ width: "100%", padding: "6px 10px", borderRadius: 4, border: "1px solid #d9d4c8", fontSize: 13 }}
                  />
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                type="button"
                onClick={() => setInspectingJob(null)}
                style={{
                  minHeight: 44,
                  padding: "8px 14px",
                  borderRadius: 6,
                  border: "1px solid #d9d4c8",
                  background: "#ffffff",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveMilestone()}
                disabled={submittingQC}
                style={{
                  minHeight: 44,
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "#23483a",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: submittingQC ? "not-allowed" : "pointer",
                }}
              >
                {submittingQC ? "Recording..." : "Save Milestone Result"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Release Job Modal */}
      <ReleaseJobModal
        isOpen={releaseModalOpen}
        onClose={() => setReleaseModalOpen(false)}
        onReleased={() => void fetchJobs()}
      />
    </div>
  );
}
