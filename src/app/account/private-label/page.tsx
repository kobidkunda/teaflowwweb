"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Plus, Sparkles, RefreshCw, ArrowRight } from "lucide-react";

interface OrderItem {
  id: string;
  order_number: string;
  status: string;
  total_paise: number;
  deposit_paise: number;
  balance_paise: number;
  created_at: string;
}

interface SampleItem {
  id: string;
  sample_number: string;
  sample_type: string;
  status: string;
  amount_paise: number;
  quantity: number;
  created_at: string;
}

export default function CustomerPrivateLabelHubPage() {
  const [activeTab, setActiveTab] = useState<"orders" | "samples" | "projects">("projects");
  const [projects, setProjects] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [samples, setSamples] = useState<SampleItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [ordersRes, samplesRes, projectsRes] = await Promise.all([
          fetch("/api/v1/private-label/orders"),
          fetch("/api/v1/private-label/samples"),
          fetch("/api/v1/private-label/projects"),
        ]);

        if (!ordersRes.ok || !samplesRes.ok || !projectsRes.ok) throw new Error("Unable to load your workspace. Sign in again or retry.");
        const projectData = await projectsRes.json();
        setProjects(projectData.projects || []);
        if (ordersRes.ok) {
          const ordData = await ordersRes.json();
          setOrders(ordData.orders || ordData || []);
        }

        if (samplesRes.ok) {
          const smpData = await samplesRes.json();
          setSamples(smpData.samples || smpData || []);
        }
      } catch (error) {
        setError(error instanceof Error ? error.message : "Unable to load your workspace.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const formatPaise = (paise: number) => `₹${(paise / 100).toLocaleString("en-IN")}`;

  return (
    <div className="min-h-screen bg-[#FBF9F4] py-12 px-4">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Hub Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-[#E8E4DC] gap-4">
          <div>
            <h1 className="text-3xl font-serif font-bold text-[#143C31]">Private Label Atelier Hub</h1>
            <p className="text-sm text-[#65746D] mt-1">
              Manage custom bespoke tea packaging runs, trial sample kits, and Siliguri manufacturing schedules.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/private-label/samples"
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-[#143C31] text-[#143C31] hover:bg-[#F3EFE6] transition-colors"
            >
              Order Trial Samples
            </Link>
            <Link
              href="/private-label/studio"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-[#143C31] text-white hover:bg-[#1E5244] transition-colors shadow-2xs"
            >
              <Plus size={14} /> New Custom Run
            </Link>
          </div>
        </div>

        {/* Tab Selection */}
        <div
          role="tablist"
          aria-label="Private Label Workspace Sections"
          className="flex border-b border-[#E8E4DC] gap-6 text-sm overflow-x-auto"
          onKeyDown={e => {
            const tabs = ["projects", "orders", "samples"] as const;
            const index = tabs.indexOf(activeTab);
            if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(e.key)) {
              e.preventDefault();
              const next = e.key === "Home" ? 0 : e.key === "End" ? 2 : (index + (e.key === "ArrowRight" ? 1 : -1) + 3) % 3;
              setActiveTab(tabs[next]);
              document.getElementById(`tab-${tabs[next]}`)?.focus();
            }
          }}
        >
          <button type="button" role="tab" id="tab-projects" aria-selected={activeTab === "projects"} aria-controls="panel-projects" tabIndex={activeTab === "projects" ? 0 : -1} onClick={() => setActiveTab("projects")} className="pb-3 font-medium whitespace-nowrap">Saved Projects ({projects.length})</button>
          <button
            type="button"
            role="tab"
            id="tab-orders"
            aria-selected={activeTab === "orders"}
            aria-controls="panel-orders"
            tabIndex={activeTab === "orders" ? 0 : -1}
            onClick={() => setActiveTab("orders")}
            className={`pb-3 font-medium transition-colors ${
              activeTab === "orders"
                ? "border-b-2 border-[#143C31] text-[#143C31] font-bold"
                : "text-[#65746D] hover:text-[#143C31]"
            }`}
          >
            Production Orders ({orders.length})
          </button>
          <button
            type="button"
            role="tab"
            id="tab-samples"
            aria-selected={activeTab === "samples"}
            aria-controls="panel-samples"
            tabIndex={activeTab === "samples" ? 0 : -1}
            onClick={() => setActiveTab("samples")}
            className={`pb-3 font-medium transition-colors ${
              activeTab === "samples"
                ? "border-b-2 border-[#143C31] text-[#143C31] font-bold"
                : "text-[#65746D] hover:text-[#143C31]"
            }`}
          >
            Trial Sample Kits ({samples.length})
          </button>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-[#65746D]">
            <RefreshCw className="w-8 h-8 animate-spin text-[#143C31] mb-3" />
            <p className="text-sm">Loading Private Label workspace...</p>
          </div>
        ) : error ? (
          <div role="alert"><p>{error}</p><button type="button" onClick={() => window.location.reload()}>Retry</button> · <Link href="/login?redirect=%2Faccount%2Fprivate-label">Sign in</Link></div>
        ) : activeTab === "projects" ? (
          <div role="tabpanel" id="panel-projects" aria-labelledby="tab-projects" tabIndex={0} className="space-y-4">
            {projects.length === 0 ? <p>No saved projects yet. <Link href="/private-label/studio">Start your brand</Link></p> : projects.map(project => (
              <article key={project.id} className="bg-white border border-[#E8E4DC] rounded-xl p-5 flex flex-col md:flex-row justify-between gap-3">
                <div><h2 className="font-serif text-xl">{project.title}</h2><p className="text-sm">{project.status.replace(/_/g, " ")}</p></div>
                <Link href={`/private-label/studio?project=${encodeURIComponent(project.id)}`} className="underline">Continue project →</Link>
              </article>
            ))}
          </div>
        ) : activeTab === "orders" ? (
          <div
            role="tabpanel"
            id="panel-orders"
            aria-labelledby="tab-orders"
            tabIndex={0}
          >
          {orders.length === 0 ? (
            /* Empty State for Orders (Test F28.B1) */
            <div className="bg-white border border-[#E8E4DC] rounded-2xl p-10 text-center shadow-xs max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#EBF3EF] text-[#143C31] flex items-center justify-center mx-auto">
                <Sparkles size={24} />
              </div>
              <h2 className="text-xl font-serif font-bold text-[#143C31]">No Active Production Orders</h2>
              <p className="text-xs text-[#65746D] max-w-sm mx-auto">
                Begin with single-estate harvest curation and custom dieline packaging tailored to your brand identity.
              </p>
              <div className="pt-2">
                <Link
                  href="/private-label/studio"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#143C31] text-white hover:bg-[#1E5244] transition-colors shadow-2xs"
                >
                  Start Your Brand <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((o) => (
                <div
                  key={o.id}
                  className="bg-white border border-[#E8E4DC] rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4 hover:border-[#143C31] transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-[#143C31] text-base">{o.order_number}</span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#EBF3EF] text-[#143C31] border border-[#C5D6CC]">
                        {o.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-[#65746D]">
                      Contract Total: <span className="font-medium text-[#143C31]">{formatPaise(o.total_paise)}</span> | Deposit: {formatPaise(o.deposit_paise)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/private-label/orders/${o.id}`}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-[#143C31] text-white hover:bg-[#1E5244] transition-colors"
                    >
                      View QC & Production Dossier <ArrowRight size={12} />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        ) : (
          /* Samples Tab */
          <div
            role="tabpanel"
            id="panel-samples"
            aria-labelledby="tab-samples"
            tabIndex={0}
          >
          {samples.length === 0 ? (
            <div className="bg-white border border-[#E8E4DC] rounded-2xl p-10 text-center shadow-xs max-w-xl mx-auto space-y-4">
              <div className="w-12 h-12 rounded-full bg-[#EBF3EF] text-[#143C31] flex items-center justify-center mx-auto">
                <Package size={24} />
              </div>
              <h2 className="text-xl font-serif font-bold text-[#143C31]">No Sample Requests Recorded</h2>
              <p className="text-xs text-[#65746D] max-w-sm mx-auto">
                Request tea tasting kits, packaging material swatches, or printed dieline proofs delivered to your door.
              </p>
              <div className="pt-2">
                <Link
                  href="/private-label/samples"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider bg-[#143C31] text-white hover:bg-[#1E5244] transition-colors shadow-2xs"
                >
                  Order Sample Kit <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {samples.map((s) => (
                <div
                  key={s.id}
                  className="bg-white border border-[#E8E4DC] rounded-xl p-5 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-serif font-bold text-[#143C31] text-base">{s.sample_number}</span>
                      <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-[#EBF3EF] text-[#143C31] border border-[#C5D6CC]">
                        {s.status.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-[#65746D]">
                      Type: <span className="font-medium text-[#143C31] capitalize">{s.sample_type.replace(/_/g, " ")}</span> | Quantity: {s.quantity}
                    </p>
                  </div>
                  <div className="text-xs text-[#65746D]">
                    {new Date(s.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                  </div>
                </div>
              ))}
            </div>
          )}
          </div>
        )}
      </div>
    </div>
  );
}
