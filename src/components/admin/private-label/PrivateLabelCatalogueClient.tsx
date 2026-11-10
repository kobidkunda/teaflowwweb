"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Boxes,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  Archive,
  Layers,
  Edit,
  Check,
  X,
  FileSpreadsheet,
  Upload,
  Image as ImageIcon,
  Trash2,
  ExternalLink,
  Loader2,
} from "lucide-react";

interface PackagingItem {
  id: string;
  slug: string;
  sku: string;
  title: string;
  family_id?: string;
  family_name?: string;
  family_code?: string;
  material: string;
  finish?: string;
  closure_type?: string;
  capacity_description?: string;
  net_weight_capacity_grams: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number | null;
  label_safe_width_mm?: number;
  label_safe_height_mm?: number;
  supplier_name: string;
  supplier_sku?: string | null;
  unit_cost_paise: number;
  lead_time_days?: number;
  moq_units: number;
  order_multiple?: number;
  dieline_url?: string | null;
  hero_image_url?: string | null;
  image_illustrative?: number | boolean;
  status: "draft" | "published" | "archived";
  revision: number;
  can_publish: boolean;
  blockers: string[];
  compatible_print_methods?: Array<{ id: string; code: string; name: string }>;
}

interface TeaItem {
  id: string;
  slug: string;
  name: string;
  origin_estate: string;
  region: string;
  grade: string;
  flush: string;
  tea_category: string;
  description?: string;
  caffeine_level?: string;
  base_cost_per_kg_paise: number;
  min_batch_kg: number;
  tasting_notes_json?: string;
  is_published: number;
  sample_available?: number;
  revision: number;
  can_publish: boolean;
  blockers: string[];
}

interface PrintMethodItem {
  id: string;
  code: string;
  name: string;
  color_model: string;
  max_colors: number;
  setup_fee_paise: number;
  cylinder_fee_per_color_paise: number;
  min_order_units: number;
  is_active: number;
}

interface FamilyItem {
  id: string;
  code: string;
  name: string;
  description: string;
}

interface PackagingFormData {
  id?: string;
  title: string;
  sku: string;
  slug: string;
  family_id: string;
  status: "draft" | "published" | "archived";
  material: string;
  finish: string;
  closure_type: string;
  capacity_description: string;
  net_weight_capacity_grams: number;
  width_mm: number;
  height_mm: number;
  depth_mm: number | "";
  label_safe_width_mm: number;
  label_safe_height_mm: number;
  supplier_name: string;
  supplier_sku: string;
  unit_cost_inr: string;
  lead_time_days: number;
  moq_units: number;
  order_multiple: number;
  hero_image_url: string;
  dieline_url: string;
  image_illustrative: boolean;
  compatible_print_method_ids: string[];
  expected_revision?: number;
}

interface TeaFormData {
  id?: string;
  name: string;
  slug: string;
  origin_estate: string;
  region: string;
  grade: string;
  flush: string;
  tea_category: string;
  description: string;
  caffeine_level: string;
  base_cost_per_kg_inr: string;
  min_batch_kg: number;
  tasting_notes_str: string;
  is_published: boolean;
  expected_revision?: number;
}

const defaultPackagingForm: PackagingFormData = {
  title: "",
  sku: "",
  slug: "",
  family_id: "",
  status: "draft",
  material: "",
  finish: "",
  closure_type: "",
  capacity_description: "",
  net_weight_capacity_grams: 250,
  width_mm: 160,
  height_mm: 230,
  depth_mm: "",
  label_safe_width_mm: 120,
  label_safe_height_mm: 150,
  supplier_name: "",
  supplier_sku: "",
  unit_cost_inr: "18.50",
  lead_time_days: 14,
  moq_units: 500,
  order_multiple: 50,
  hero_image_url: "",
  dieline_url: "",
  image_illustrative: true,
  compatible_print_method_ids: [],
};

const defaultTeaForm: TeaFormData = {
  name: "",
  slug: "",
  origin_estate: "",
  region: "Darjeeling",
  grade: "FTGFOP1",
  flush: "First Flush",
  tea_category: "black",
  description: "",
  caffeine_level: "medium",
  base_cost_per_kg_inr: "3500.00",
  min_batch_kg: 5,
  tasting_notes_str: "Muscatel, Floral, Honey",
  is_published: false,
};

export function PrivateLabelCatalogueClient() {
  const [activeTab, setActiveTab] = useState<"packaging" | "tea" | "print">("packaging");
  const [packagingList, setPackagingList] = useState<PackagingItem[]>([]);
  const [teaList, setTeaList] = useState<TeaItem[]>([]);
  const [printMethods, setPrintMethods] = useState<PrintMethodItem[]>([]);
  const [families, setFamilies] = useState<FamilyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  // Blockers modal
  const [selectedBlockers, setSelectedBlockers] = useState<string[] | null>(null);

  // Packaging Create / Edit Modal State
  const [packagingModalOpen, setPackagingModalOpen] = useState(false);
  const [editingPackaging, setEditingPackaging] = useState<PackagingItem | null>(null);
  const [packagingForm, setPackagingForm] = useState<PackagingFormData>(defaultPackagingForm);
  const [savingPackaging, setSavingPackaging] = useState(false);
  const [packagingFormError, setPackagingFormError] = useState<string | null>(null);
  const [uploadingHero, setUploadingHero] = useState(false);
  const [uploadingDieline, setUploadingDieline] = useState(false);

  // Tea Create / Edit Modal State
  const [teaModalOpen, setTeaModalOpen] = useState(false);
  const [editingTea, setEditingTea] = useState<TeaItem | null>(null);
  const [teaForm, setTeaForm] = useState<TeaFormData>(defaultTeaForm);
  const [savingTea, setSavingTea] = useState(false);
  const [teaFormError, setTeaFormError] = useState<string | null>(null);

  const heroFileInputRef = useRef<HTMLInputElement>(null);
  const dielineFileInputRef = useRef<HTMLInputElement>(null);

  // Load auxiliary data (families and print methods)
  useEffect(() => {
    async function loadAux() {
      try {
        const [famRes, pmRes] = await Promise.all([
          fetch("/api/v1/admin/private-label/catalogue?entity=families"),
          fetch("/api/v1/admin/private-label/catalogue?entity=print_methods"),
        ]);
        const famData = await famRes.json();
        const pmData = await pmRes.json();
        if (famData.items) setFamilies(famData.items);
        if (pmData.items) setPrintMethods(pmData.items);
      } catch {
        // auxiliary catalogue metadata failure is non-fatal for initial render
      }
    }
    void loadAux();
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === "packaging") {
        const res = await fetch(
          `/api/v1/admin/private-label/catalogue?entity=packaging&status=${statusFilter}&search=${encodeURIComponent(
            search
          )}&limit=100`
        );
        const data = await res.json();
        setPackagingList(data.items || []);
      } else if (activeTab === "tea") {
        const res = await fetch(
          `/api/v1/admin/private-label/catalogue?entity=tea&status=${statusFilter}&search=${encodeURIComponent(
            search
          )}&limit=100`
        );
        const data = await res.json();
        setTeaList(data.items || []);
      } else {
        const res = await fetch("/api/v1/admin/private-label/catalogue?entity=print_methods");
        const data = await res.json();
        setPrintMethods(data.items || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error fetching catalogue data");
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter, search]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this catalogue item?")) return;
    try {
      const res = await fetch(`/api/v1/admin/private-label/catalogue/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to archive item");
      void fetchData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Archive failed");
    }
  };

  // Open Create Modal for Packaging
  const handleOpenCreatePackaging = () => {
    setEditingPackaging(null);
    setPackagingFormError(null);
    const initialFamId = families[0]?.id || "fam_pouch";
    setPackagingForm({
      ...defaultPackagingForm,
      family_id: initialFamId,
      compatible_print_method_ids: printMethods.slice(0, 2).map((pm) => pm.id),
    });
    setPackagingModalOpen(true);
  };

  // Open Edit Modal for Packaging
  const handleOpenEditPackaging = async (item: PackagingItem) => {
    setEditingPackaging(item);
    setPackagingFormError(null);

    // Fetch full item dossier including compatible print methods
    try {
      const res = await fetch(`/api/v1/admin/private-label/catalogue/${item.id}`);
      const data = await res.json();
      const variant = data.variant || data;

      const compatibleIds = Array.isArray(variant.compatible_print_methods)
        ? variant.compatible_print_methods.map((pm: { id: string }) => pm.id)
        : [];

      setPackagingForm({
        id: variant.id,
        title: variant.title || "",
        sku: variant.sku || "",
        slug: variant.slug || "",
        family_id: variant.family_id || families[0]?.id || "",
        status: variant.status || "draft",
        material: variant.material || "",
        finish: variant.finish || "",
        closure_type: variant.closure_type || "",
        capacity_description: variant.capacity_description || "",
        net_weight_capacity_grams: variant.net_weight_capacity_grams || 250,
        width_mm: variant.width_mm || 160,
        height_mm: variant.height_mm || 230,
        depth_mm: variant.depth_mm ?? "",
        label_safe_width_mm: variant.label_safe_width_mm || 120,
        label_safe_height_mm: variant.label_safe_height_mm || 150,
        supplier_name: variant.supplier_name || "",
        supplier_sku: variant.supplier_sku || "",
        unit_cost_inr: (Number(variant.unit_cost_paise || 0) / 100).toFixed(2),
        lead_time_days: variant.lead_time_days || 14,
        moq_units: variant.moq_units || 500,
        order_multiple: variant.order_multiple || 50,
        hero_image_url: variant.hero_image_url || "",
        dieline_url: variant.dieline_url || "",
        image_illustrative: Boolean(variant.image_illustrative),
        compatible_print_method_ids: compatibleIds,
        expected_revision: variant.revision,
      });
      setPackagingModalOpen(true);
    } catch {
      // Fallback to item row data
      setPackagingForm({
        id: item.id,
        title: item.title,
        sku: item.sku,
        slug: item.slug,
        family_id: item.family_id || families[0]?.id || "",
        status: item.status,
        material: item.material,
        finish: item.finish || "",
        closure_type: item.closure_type || "",
        capacity_description: item.capacity_description || "",
        net_weight_capacity_grams: item.net_weight_capacity_grams,
        width_mm: item.width_mm,
        height_mm: item.height_mm,
        depth_mm: item.depth_mm ?? "",
        label_safe_width_mm: item.label_safe_width_mm || item.width_mm,
        label_safe_height_mm: item.label_safe_height_mm || item.height_mm,
        supplier_name: item.supplier_name,
        supplier_sku: item.supplier_sku || "",
        unit_cost_inr: (Number(item.unit_cost_paise) / 100).toFixed(2),
        lead_time_days: item.lead_time_days || 14,
        moq_units: item.moq_units,
        order_multiple: item.order_multiple || 50,
        hero_image_url: item.hero_image_url || "",
        dieline_url: item.dieline_url || "",
        image_illustrative: Boolean(item.image_illustrative),
        compatible_print_method_ids: [],
        expected_revision: item.revision,
      });
      setPackagingModalOpen(true);
    }
  };

  // Upload hero image directly
  const handleHeroImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingHero(true);
    setPackagingFormError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "hero");
      if (editingPackaging?.id) {
        formData.append("packaging_id", editingPackaging.id);
      }

      const res = await fetch("/api/v1/admin/private-label/catalogue/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload hero image.");

      setPackagingForm((prev) => ({
        ...prev,
        hero_image_url: data.url,
      }));
    } catch (err) {
      setPackagingFormError(err instanceof Error ? err.message : "Image upload failed.");
    } finally {
      setUploadingHero(false);
      if (heroFileInputRef.current) heroFileInputRef.current.value = "";
    }
  };

  // Upload dieline PDF directly
  const handleDielineUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingDieline(true);
    setPackagingFormError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("type", "dieline");
      if (editingPackaging?.id) {
        formData.append("packaging_id", editingPackaging.id);
      }

      const res = await fetch("/api/v1/admin/private-label/catalogue/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload dieline document.");

      setPackagingForm((prev) => ({
        ...prev,
        dieline_url: data.url,
      }));
    } catch (err) {
      setPackagingFormError(err instanceof Error ? err.message : "Dieline upload failed.");
    } finally {
      setUploadingDieline(false);
      if (dielineFileInputRef.current) dielineFileInputRef.current.value = "";
    }
  };

  // Toggle compatible print method
  const handleTogglePrintMethod = (pmId: string) => {
    setPackagingForm((prev) => {
      const exists = prev.compatible_print_method_ids.includes(pmId);
      const updated = exists
        ? prev.compatible_print_method_ids.filter((id) => id !== pmId)
        : [...prev.compatible_print_method_ids, pmId];
      return { ...prev, compatible_print_method_ids: updated };
    });
  };

  // Submit Packaging Form (Create or Edit)
  const handleSavePackaging = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPackaging(true);
    setPackagingFormError(null);

    const costPaise = Math.round(parseFloat(packagingForm.unit_cost_inr || "0") * 100);

    const payload = {
      family_id: packagingForm.family_id,
      title: packagingForm.title.trim(),
      sku: packagingForm.sku.trim(),
      slug: packagingForm.slug.trim(),
      status: packagingForm.status,
      material: packagingForm.material.trim(),
      finish: packagingForm.finish.trim() || "Standard Matte",
      closure_type: packagingForm.closure_type.trim() || "Standard",
      capacity_description: packagingForm.capacity_description.trim() || `${packagingForm.net_weight_capacity_grams}g`,
      net_weight_capacity_grams: Number(packagingForm.net_weight_capacity_grams),
      width_mm: Number(packagingForm.width_mm),
      height_mm: Number(packagingForm.height_mm),
      depth_mm: packagingForm.depth_mm !== "" ? Number(packagingForm.depth_mm) : null,
      label_safe_width_mm: Number(packagingForm.label_safe_width_mm),
      label_safe_height_mm: Number(packagingForm.label_safe_height_mm),
      supplier_name: packagingForm.supplier_name.trim() || "Siliguri Packaging Works",
      supplier_sku: packagingForm.supplier_sku.trim() || null,
      unit_cost_paise: costPaise,
      lead_time_days: Number(packagingForm.lead_time_days || 14),
      moq_units: Number(packagingForm.moq_units || 500),
      order_multiple: Number(packagingForm.order_multiple || 50),
      hero_image_url: packagingForm.hero_image_url.trim() || null,
      dieline_url: packagingForm.dieline_url.trim() || null,
      image_illustrative: packagingForm.image_illustrative,
      compatible_print_method_ids: packagingForm.compatible_print_method_ids,
      ...(editingPackaging ? { expected_revision: packagingForm.expected_revision } : {}),
    };

    try {
      const url = editingPackaging
        ? `/api/v1/admin/private-label/catalogue/${editingPackaging.id}`
        : "/api/v1/admin/private-label/catalogue";

      const method = editingPackaging ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 422 && data.blockers) {
          throw new Error(`Publishing Blockers: ${data.blockers.join("; ")}`);
        }
        if (res.status === 409) {
          throw new Error(`Revision Conflict: This item was modified by another session. Please refresh.`);
        }
        throw new Error(data.error || "Failed to save packaging variant.");
      }

      setPackagingModalOpen(false);
      void fetchData();
    } catch (err) {
      setPackagingFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingPackaging(false);
    }
  };

  // Open Create Modal for Tea
  const handleOpenCreateTea = () => {
    setEditingTea(null);
    setTeaFormError(null);
    setTeaForm(defaultTeaForm);
    setTeaModalOpen(true);
  };

  // Open Edit Modal for Tea
  const handleOpenEditTea = async (item: TeaItem) => {
    setEditingTea(item);
    setTeaFormError(null);
    let tastingStr = "";
    try {
      if (item.tasting_notes_json) {
        const parsed = JSON.parse(item.tasting_notes_json);
        tastingStr = Array.isArray(parsed) ? parsed.join(", ") : String(parsed);
      }
    } catch {}

    setTeaForm({
      id: item.id,
      name: item.name,
      slug: item.slug,
      origin_estate: item.origin_estate,
      region: item.region,
      grade: item.grade,
      flush: item.flush,
      tea_category: item.tea_category,
      description: item.description || "",
      caffeine_level: item.caffeine_level || "medium",
      base_cost_per_kg_inr: (Number(item.base_cost_per_kg_paise) / 100).toFixed(2),
      min_batch_kg: item.min_batch_kg,
      tasting_notes_str: tastingStr,
      is_published: Boolean(item.is_published),
      expected_revision: item.revision,
    });
    setTeaModalOpen(true);
  };

  // Submit Tea Form (Create or Edit)
  const handleSaveTea = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTea(true);
    setTeaFormError(null);

    const costPaise = Math.round(parseFloat(teaForm.base_cost_per_kg_inr || "0") * 100);
    const notesArray = teaForm.tasting_notes_str
      .split(",")
      .map((n) => n.trim())
      .filter(Boolean);

    const payload = {
      entity: "tea",
      name: teaForm.name.trim(),
      slug: teaForm.slug.trim(),
      origin_estate: teaForm.origin_estate.trim(),
      region: teaForm.region.trim(),
      grade: teaForm.grade.trim(),
      flush: teaForm.flush.trim(),
      tea_category: teaForm.tea_category,
      description: teaForm.description.trim(),
      caffeine_level: teaForm.caffeine_level,
      base_cost_per_kg_paise: costPaise,
      min_batch_kg: Number(teaForm.min_batch_kg),
      tasting_notes: notesArray,
      is_published: teaForm.is_published,
      ...(editingTea ? { expected_revision: teaForm.expected_revision } : {}),
    };

    try {
      const url = editingTea
        ? `/api/v1/admin/private-label/catalogue/${editingTea.id}`
        : "/api/v1/admin/private-label/catalogue";

      const method = editingTea ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 422 && data.blockers) {
          throw new Error(`Publishing Blockers: ${data.blockers.join("; ")}`);
        }
        if (res.status === 409) {
          throw new Error(`Revision Conflict: Item was updated in another session.`);
        }
        throw new Error(data.error || "Failed to save tea option.");
      }

      setTeaModalOpen(false);
      void fetchData();
    } catch (err) {
      setTeaFormError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingTea(false);
    }
  };

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1440, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, flexWrap: "wrap", gap: 16 }}>
        <div>
          <span style={{ fontSize: 12, textTransform: "uppercase", letterSpacing: "0.08em", color: "#6a6e64", fontWeight: 600 }}>
            Private Label Studio
          </span>
          <h1 style={{ margin: "4px 0", fontSize: 28, fontWeight: 700, color: "var(--forest, #1d2a24)", fontFamily: "var(--font-serif, Georgia, serif)" }}>
            Catalogue Management
          </h1>
          <p style={{ margin: 0, fontSize: 14, color: "#555850" }}>
            Curate packaging structures, single estate tea options, print methods, and compatibility rules.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          {activeTab === "packaging" && (
            <button
              type="button"
              onClick={handleOpenCreatePackaging}
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
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <Plus size={15} />
              <span>New Packaging Variant</span>
            </button>
          )}

          {activeTab === "tea" && (
            <button
              type="button"
              onClick={handleOpenCreateTea}
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
                boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
              }}
            >
              <Plus size={15} />
              <span>New Tea Option</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void fetchData()}
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
            <RefreshCw size={14} className={loading ? "spin-icon" : ""} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, borderBottom: "2px solid #ede9df", marginBottom: 20 }} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "packaging"}
          onClick={() => setActiveTab("packaging")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            background: "none",
            borderBottom: activeTab === "packaging" ? "3px solid #23483a" : "3px solid transparent",
            color: activeTab === "packaging" ? "#23483a" : "#6a6e64",
            cursor: "pointer",
            marginBottom: -2,
          }}
        >
          Packaging Structures &amp; Variants
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "tea"}
          onClick={() => setActiveTab("tea")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            background: "none",
            borderBottom: activeTab === "tea" ? "3px solid #23483a" : "3px solid transparent",
            color: activeTab === "tea" ? "#23483a" : "#6a6e64",
            cursor: "pointer",
            marginBottom: -2,
          }}
        >
          Tea Sourcing Options
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "print"}
          onClick={() => setActiveTab("print")}
          style={{
            padding: "10px 18px",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            background: "none",
            borderBottom: activeTab === "print" ? "3px solid #23483a" : "3px solid transparent",
            color: activeTab === "print" ? "#23483a" : "#6a6e64",
            cursor: "pointer",
            marginBottom: -2,
          }}
        >
          Print Methods
        </button>
      </div>

      {/* Filter Strip */}
      {activeTab !== "print" && (
        <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", minWidth: 260 }}>
            <Search size={16} style={{ position: "absolute", left: 10, top: 10, color: "#888" }} />
            <input
              type="text"
              placeholder={`Search ${activeTab === "packaging" ? "packaging by title, SKU, supplier..." : "teas by name, estate, grade..."}`}
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
            <option value="all">All Statuses</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 16px", marginBottom: 16, background: "#fdf2f2", color: "#9b1c1c", borderRadius: 6, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Content for Tab 1: Packaging */}
      {activeTab === "packaging" && (
        <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#ede9df", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Title &amp; SKU</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Family</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Dimensions &amp; Capacity</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Unit Cost (₹)</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>MOQ</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Publishing Gate</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Status</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {packagingList.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f0ece1" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      {item.hero_image_url ? (
                        <img
                          src={item.hero_image_url}
                          alt={item.title}
                          style={{ width: 36, height: 36, objectFit: "cover", borderRadius: 4, border: "1px solid #e2ddd2" }}
                        />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 4, background: "#f0ece1", display: "flex", alignItems: "center", justifyContent: "center", color: "#8a877d" }}>
                          <ImageIcon size={18} />
                        </div>
                      )}
                      <div>
                        <div style={{ fontWeight: 600, color: "#1d2a24" }}>{item.title}</div>
                        <div style={{ fontSize: 11, fontFamily: "monospace", color: "#6a6e64" }}>{item.sku}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "10px 14px", textTransform: "capitalize" }}>
                    {item.family_code || item.family_name || "-"}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#555" }}>
                    {item.width_mm} × {item.height_mm} mm · {item.net_weight_capacity_grams}g
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                    ₹{(item.unit_cost_paise / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#555" }}>
                    {item.moq_units.toLocaleString()} units
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {item.can_publish ? (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "#e8f5e9",
                          color: "#1b5e20",
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        <CheckCircle size={12} />
                        <span>Ready</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedBlockers(item.blockers)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "#fdf2f2",
                          color: "#9b1c1c",
                          fontSize: 11,
                          fontWeight: 600,
                          border: "1px solid #f8b4b4",
                          cursor: "pointer",
                        }}
                        title="Click to view publishing blockers"
                      >
                        <AlertTriangle size={12} />
                        <span>Blocked ({item.blockers.length})</span>
                      </button>
                    )}
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
                        background: item.status === "published" ? "#e8f5e9" : item.status === "draft" ? "#fff8e1" : "#f1f5f9",
                        color: item.status === "published" ? "#1b5e20" : item.status === "draft" ? "#8d6000" : "#334155",
                      }}
                    >
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <button
                        type="button"
                        onClick={() => void handleOpenEditPackaging(item)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 4,
                          border: "1px solid #23483a",
                          background: "#ffffff",
                          color: "#23483a",
                          cursor: "pointer",
                        }}
                        title="Edit packaging variant specifications"
                      >
                        <Edit size={11} />
                        <span>Edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleArchive(item.id)}
                        disabled={item.status === "published"}
                        style={{
                          padding: "4px 8px",
                          fontSize: 11,
                          borderRadius: 4,
                          border: "1px solid #d9d4c8",
                          background: item.status === "published" ? "#f5f5f5" : "#ffffff",
                          color: item.status === "published" ? "#aaa" : "#8f2f2a",
                          cursor: item.status === "published" ? "not-allowed" : "pointer",
                        }}
                        title={item.status === "published" ? "Cannot archive published variant. Set to draft first." : "Archive variant"}
                      >
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {packagingList.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: "center", color: "#888" }}>
              No packaging variants found matching filters.
            </div>
          )}
        </div>
      )}

      {/* Content for Tab 2: Tea Options */}
      {activeTab === "tea" && (
        <div style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "#ede9df", textAlign: "left" }}>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Tea Name &amp; Category</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Estate &amp; Region</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Grade &amp; Flush</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Base Cost/kg (₹)</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Min Batch</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Publishing Gate</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Status</th>
                <th style={{ padding: "10px 14px", borderBottom: "1px solid #d9d4c8" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {teaList.map((item) => (
                <tr key={item.id} style={{ borderBottom: "1px solid #f0ece1" }}>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ fontWeight: 600, color: "#1d2a24" }}>{item.name}</div>
                    <div style={{ fontSize: 11, color: "#6a6e64", textTransform: "capitalize" }}>{item.tea_category}</div>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div>{item.origin_estate}</div>
                    <div style={{ fontSize: 11, color: "#777" }}>{item.region}</div>
                  </td>
                  <td style={{ padding: "10px 14px", color: "#555" }}>
                    {item.grade} · {item.flush}
                  </td>
                  <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                    ₹{(item.base_cost_per_kg_paise / 100).toFixed(2)}
                  </td>
                  <td style={{ padding: "10px 14px", color: "#555" }}>
                    {item.min_batch_kg} kg
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    {item.can_publish ? (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#1b5e20", fontSize: 11, fontWeight: 600 }}>
                        <CheckCircle size={12} /> Ready
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedBlockers(item.blockers)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "2px 8px",
                          borderRadius: 4,
                          background: "#fdf2f2",
                          color: "#9b1c1c",
                          fontSize: 11,
                          fontWeight: 600,
                          border: "1px solid #f8b4b4",
                          cursor: "pointer",
                        }}
                      >
                        <AlertTriangle size={12} /> Blocked ({item.blockers.length})
                      </button>
                    )}
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: item.is_published ? "#e8f5e9" : "#fff8e1",
                        color: item.is_published ? "#1b5e20" : "#8d6000",
                      }}
                    >
                      {item.is_published ? "Published" : "Draft"}
                    </span>
                  </td>
                  <td style={{ padding: "10px 14px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => void handleOpenEditTea(item)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                          padding: "4px 8px",
                          fontSize: 11,
                          fontWeight: 600,
                          borderRadius: 4,
                          border: "1px solid #23483a",
                          background: "#ffffff",
                          color: "#23483a",
                          cursor: "pointer",
                        }}
                      >
                        <Edit size={11} />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchive(item.id)}
                        disabled={Boolean(item.is_published)}
                        style={{
                          padding: "4px 8px",
                          fontSize: 11,
                          borderRadius: 4,
                          border: "1px solid #d9d4c8",
                          background: item.is_published ? "#f5f5f5" : "#ffffff",
                          color: item.is_published ? "#aaa" : "#8f2f2a",
                          cursor: item.is_published ? "not-allowed" : "pointer",
                        }}
                      >
                        Archive
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {teaList.length === 0 && !loading && (
            <div style={{ padding: 24, textAlign: "center", color: "#888" }}>
              No tea options found matching filters.
            </div>
          )}
        </div>
      )}

      {/* Content for Tab 3: Print Methods */}
      {activeTab === "print" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {printMethods.map((pm) => (
            <div key={pm.id} style={{ background: "#ffffff", border: "1px solid #d9d4c8", borderRadius: 8, padding: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: "#1d2a24" }}>{pm.name}</span>
                <span style={{ fontSize: 11, padding: "2px 6px", borderRadius: 4, background: "#ede9df", color: "#555" }}>
                  {pm.color_model.toUpperCase()}
                </span>
              </div>
              <div style={{ fontSize: 12, fontFamily: "monospace", color: "#6a6e64", marginBottom: 12 }}>
                Code: {pm.code}
              </div>
              <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>
                <strong>Setup Fee:</strong> ₹{(pm.setup_fee_paise / 100).toFixed(2)}
              </div>
              {pm.cylinder_fee_per_color_paise > 0 && (
                <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>
                  <strong>Cylinder Fee / Color:</strong> ₹{(pm.cylinder_fee_per_color_paise / 100).toFixed(2)}
                </div>
              )}
              <div style={{ fontSize: 13, color: "#444", marginBottom: 6 }}>
                <strong>Max Colors:</strong> {pm.max_colors}
              </div>
              <div style={{ fontSize: 13, color: "#444" }}>
                <strong>Minimum Run:</strong> {pm.min_order_units.toLocaleString()} units
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Packaging Create / Edit Modal */}
      {packagingModalOpen && (
        <dialog
          open
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.45)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 10,
              maxWidth: 860,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #ede9df",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#faf8f5",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1d2a24" }}>
                  {editingPackaging ? `Edit Packaging Variant` : `Create Packaging Variant`}
                </h2>
                <div style={{ fontSize: 12, color: "#6a6e64", marginTop: 2 }}>
                  {editingPackaging
                    ? `SKU: ${editingPackaging.sku} · Revision ${editingPackaging.revision}`
                    : "Define technical dimensions, safe print areas, supplier commercials, and images."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPackagingModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4, color: "#555" }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body / Form */}
            <form onSubmit={handleSavePackaging} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 20 }}>
              {packagingFormError && (
                <div style={{ padding: "10px 14px", background: "#fdf2f2", color: "#9b1c1c", borderRadius: 6, fontSize: 13, border: "1px solid #f8b4b4" }}>
                  {packagingFormError}
                </div>
              )}

              {/* SECTION 1: Identity & Classification */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#23483a", borderBottom: "1px solid #ede9df", paddingBottom: 6, marginBottom: 12 }}>
                  1. Identification &amp; Family
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                      Variant Title *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Stand-Up Pouch Matte Black 250g"
                      value={packagingForm.title}
                      onChange={(e) => {
                        const title = e.target.value;
                        setPackagingForm((prev) => ({
                          ...prev,
                          title,
                          slug: editingPackaging ? prev.slug : title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                        }));
                      }}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                      SKU Code *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="PL-PC-250-MBK"
                      value={packagingForm.sku}
                      onChange={(e) => setPackagingForm({ ...packagingForm, sku: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 13, fontFamily: "monospace", borderRadius: 6, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                      Family *
                    </label>
                    <select
                      value={packagingForm.family_id}
                      onChange={(e) => setPackagingForm({ ...packagingForm, family_id: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d9d4c8", background: "#fff" }}
                    >
                      {families.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12, marginTop: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                      URL Slug *
                    </label>
                    <input
                      type="text"
                      required
                      value={packagingForm.slug}
                      onChange={(e) => setPackagingForm({ ...packagingForm, slug: e.target.value })}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 12, fontFamily: "monospace", borderRadius: 6, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                      Publication Status
                    </label>
                    <select
                      value={packagingForm.status}
                      onChange={(e) => setPackagingForm({ ...packagingForm, status: e.target.value as "draft" | "published" | "archived" })}
                      style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d9d4c8", background: "#fff" }}
                    >
                      <option value="draft">Draft (Private in Studio)</option>
                      <option value="published">Published (Storefront Visible)</option>
                      <option value="archived">Archived</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Media, Hero Image & Dielines */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#23483a", borderBottom: "1px solid #ede9df", paddingBottom: 6, marginBottom: 12 }}>
                  2. Hero Imagery &amp; Dieline Documents
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                  {/* Hero Image */}
                  <div style={{ border: "1px solid #ede9df", borderRadius: 8, padding: 14, background: "#faf8f5" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#23483a" }}>
                        Hero Product Render / Image
                      </label>
                      {uploadingHero && (
                        <span style={{ fontSize: 11, color: "#23483a", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Loader2 size={12} className="spin-icon" /> Uploading...
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
                      {packagingForm.hero_image_url ? (
                        <div style={{ position: "relative" }}>
                          <img
                            src={packagingForm.hero_image_url}
                            alt="Hero preview"
                            style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 6, border: "1px solid #d9d4c8" }}
                          />
                          <button
                            type="button"
                            onClick={() => setPackagingForm({ ...packagingForm, hero_image_url: "" })}
                            style={{
                              position: "absolute",
                              top: -6,
                              right: -6,
                              background: "#8f2f2a",
                              color: "#fff",
                              border: "none",
                              borderRadius: "50%",
                              width: 18,
                              height: 18,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                            }}
                            title="Remove image"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      ) : (
                        <div
                          style={{
                            width: 64,
                            height: 64,
                            borderRadius: 6,
                            border: "1px dashed #c0bba9",
                            background: "#fff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#8a877d",
                          }}
                        >
                          <ImageIcon size={22} />
                        </div>
                      )}

                      <div style={{ flex: 1 }}>
                        <input
                          type="file"
                          ref={heroFileInputRef}
                          accept="image/png,image/jpeg,image/webp,image/avif"
                          onChange={handleHeroImageUpload}
                          style={{ display: "none" }}
                          id="hero-file-input"
                        />
                        <button
                          type="button"
                          onClick={() => heroFileInputRef.current?.click()}
                          disabled={uploadingHero}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "6px 12px",
                            fontSize: 12,
                            borderRadius: 6,
                            border: "1px solid #23483a",
                            background: "#ffffff",
                            color: "#23483a",
                            cursor: uploadingHero ? "not-allowed" : "pointer",
                            fontWeight: 600,
                          }}
                        >
                          <Upload size={13} />
                          <span>{packagingForm.hero_image_url ? "Replace Image" : "Upload File"}</span>
                        </button>
                        <div style={{ fontSize: 11, color: "#6a6e64", marginTop: 4 }}>
                          Supports PNG, JPG, WebP (max 5MB)
                        </div>
                      </div>
                    </div>

                    <div>
                      <input
                        type="text"
                        placeholder="Or enter direct image URL (/uploads/... or https://...)"
                        value={packagingForm.hero_image_url}
                        onChange={(e) => setPackagingForm({ ...packagingForm, hero_image_url: e.target.value })}
                        style={{ width: "100%", padding: "6px 8px", fontSize: 11, borderRadius: 4, border: "1px solid #d9d4c8" }}
                      />
                    </div>

                    <label style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, fontSize: 11, color: "#555", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={packagingForm.image_illustrative}
                        onChange={(e) => setPackagingForm({ ...packagingForm, image_illustrative: e.target.checked })}
                      />
                      <span>Mark as illustrative digital 3D mockup</span>
                    </label>
                  </div>

                  {/* Dieline Document */}
                  <div style={{ border: "1px solid #ede9df", borderRadius: 8, padding: 14, background: "#faf8f5" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: "#23483a" }}>
                        Dieline Vector / Template PDF
                      </label>
                      {uploadingDieline && (
                        <span style={{ fontSize: 11, color: "#23483a", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <Loader2 size={12} className="spin-icon" /> Uploading...
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                      <input
                        type="file"
                        ref={dielineFileInputRef}
                        accept="application/pdf,image/png,image/jpeg"
                        onChange={handleDielineUpload}
                        style={{ display: "none" }}
                        id="dieline-file-input"
                      />
                      <button
                        type="button"
                        onClick={() => dielineFileInputRef.current?.click()}
                        disabled={uploadingDieline}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "6px 12px",
                          fontSize: 12,
                          borderRadius: 6,
                          border: "1px solid #23483a",
                          background: "#ffffff",
                          color: "#23483a",
                          cursor: uploadingDieline ? "not-allowed" : "pointer",
                          fontWeight: 600,
                        }}
                      >
                        <Upload size={13} />
                        <span>Upload Dieline PDF</span>
                      </button>

                      {packagingForm.dieline_url && (
                        <a
                          href={packagingForm.dieline_url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            fontSize: 12,
                            color: "#23483a",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            textDecoration: "underline",
                          }}
                        >
                          <ExternalLink size={12} /> View File
                        </a>
                      )}
                    </div>

                    <input
                      type="text"
                      placeholder="Dieline path (e.g. /dielines/standup-pouch-250g.pdf)"
                      value={packagingForm.dieline_url}
                      onChange={(e) => setPackagingForm({ ...packagingForm, dieline_url: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 11, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 3: Technical Specs & Safe Area */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#23483a", borderBottom: "1px solid #ede9df", paddingBottom: 6, marginBottom: 12 }}>
                  3. Physical Dimensions &amp; Print Safe Zones (mm)
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Width (mm) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={packagingForm.width_mm}
                      onChange={(e) => setPackagingForm({ ...packagingForm, width_mm: Number(e.target.value) })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Height (mm) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={packagingForm.height_mm}
                      onChange={(e) => setPackagingForm({ ...packagingForm, height_mm: Number(e.target.value) })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Depth / Gusset (mm)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={packagingForm.depth_mm}
                      onChange={(e) => setPackagingForm({ ...packagingForm, depth_mm: e.target.value === "" ? "" : Number(e.target.value) })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Safe Width (mm) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={packagingForm.width_mm || 9999}
                      value={packagingForm.label_safe_width_mm}
                      onChange={(e) => setPackagingForm({ ...packagingForm, label_safe_width_mm: Number(e.target.value) })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Safe Height (mm) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      max={packagingForm.height_mm || 9999}
                      value={packagingForm.label_safe_height_mm}
                      onChange={(e) => setPackagingForm({ ...packagingForm, label_safe_height_mm: Number(e.target.value) })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Material Substrate *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Kraft / Foil Barrier"
                      value={packagingForm.material}
                      onChange={(e) => setPackagingForm({ ...packagingForm, material: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Finish
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Soft-Touch Matte"
                      value={packagingForm.finish}
                      onChange={(e) => setPackagingForm({ ...packagingForm, finish: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Closure Type
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Resealable Grip Zipper"
                      value={packagingForm.closure_type}
                      onChange={(e) => setPackagingForm({ ...packagingForm, closure_type: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Capacity Description
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 250g Retail / 8.8oz"
                      value={packagingForm.capacity_description}
                      onChange={(e) => setPackagingForm({ ...packagingForm, capacity_description: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Net Weight Capacity (Grams) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={packagingForm.net_weight_capacity_grams}
                      onChange={(e) => setPackagingForm({ ...packagingForm, net_weight_capacity_grams: Number(e.target.value) })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4: Supplier & Commercial Pricing */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#23483a", borderBottom: "1px solid #ede9df", paddingBottom: 6, marginBottom: 12 }}>
                  4. Commercial Terms &amp; Sourcing
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr 1fr", gap: 10 }}>
                  <div style={{ gridColumn: "span 2" }}>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Supplier Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. EcoBarrier Pack India"
                      value={packagingForm.supplier_name}
                      onChange={(e) => setPackagingForm({ ...packagingForm, supplier_name: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Unit Cost (₹) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      min={0.01}
                      value={packagingForm.unit_cost_inr}
                      onChange={(e) => setPackagingForm({ ...packagingForm, unit_cost_inr: e.target.value })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8", fontWeight: 600 }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      MOQ (Units) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={packagingForm.moq_units}
                      onChange={(e) => setPackagingForm({ ...packagingForm, moq_units: Number(e.target.value) })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Order Multiple *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={packagingForm.order_multiple}
                      onChange={(e) => setPackagingForm({ ...packagingForm, order_multiple: Number(e.target.value) })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#444", marginBottom: 3 }}>
                      Lead Time (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={packagingForm.lead_time_days}
                      onChange={(e) => setPackagingForm({ ...packagingForm, lead_time_days: Number(e.target.value) })}
                      style={{ width: "100%", padding: "6px 8px", fontSize: 12, borderRadius: 4, border: "1px solid #d9d4c8" }}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 5: Print Compatibility */}
              <div>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#23483a", borderBottom: "1px solid #ede9df", paddingBottom: 6, marginBottom: 8 }}>
                  5. Compatible Print Methods *
                </h3>
                <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "#6a6e64" }}>
                  Select which printing methods are validated for this structure. At least one method is required to publish.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
                  {printMethods.map((pm) => {
                    const isChecked = packagingForm.compatible_print_method_ids.includes(pm.id);
                    return (
                      <label
                        key={pm.id}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          padding: "8px 12px",
                          borderRadius: 6,
                          border: isChecked ? "1px solid #23483a" : "1px solid #d9d4c8",
                          background: isChecked ? "#f0fdf4" : "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePrintMethod(pm.id)}
                          style={{ marginTop: 2 }}
                        />
                        <div>
                          <div style={{ fontSize: 12, fontWeight: 600, color: "#1d2a24" }}>{pm.name}</div>
                          <div style={{ fontSize: 11, color: "#6a6e64" }}>
                            {pm.color_model.toUpperCase()} · Min {pm.min_order_units}u
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Modal Actions */}
              <div
                style={{
                  paddingTop: 16,
                  borderTop: "1px solid #ede9df",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 12,
                }}
              >
                <button
                  type="button"
                  onClick={() => setPackagingModalOpen(false)}
                  style={{
                    padding: "8px 18px",
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
                  type="submit"
                  disabled={savingPackaging}
                  style={{
                    padding: "8px 22px",
                    borderRadius: 6,
                    border: "none",
                    background: "#23483a",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: savingPackaging ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {savingPackaging && <Loader2 size={14} className="spin-icon" />}
                  <span>{editingPackaging ? "Save Changes" : "Create Variant"}</span>
                </button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {/* Tea Option Create / Edit Modal */}
      {teaModalOpen && (
        <dialog
          open
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.45)",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
            zIndex: 1000,
          }}
        >
          <div
            style={{
              background: "#ffffff",
              borderRadius: 10,
              maxWidth: 720,
              width: "100%",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                padding: "18px 24px",
                borderBottom: "1px solid #ede9df",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "#faf8f5",
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#1d2a24" }}>
                  {editingTea ? `Edit Tea Option` : `Create Single-Estate Tea Option`}
                </h2>
                <div style={{ fontSize: 12, color: "#6a6e64", marginTop: 2 }}>
                  {editingTea ? `Editing ${editingTea.name} (Rev ${editingTea.revision})` : "Configure tea origin, grade, flush, and base sourcing pricing."}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTeaModalOpen(false)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveTea} style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
              {teaFormError && (
                <div style={{ padding: "10px 14px", background: "#fdf2f2", color: "#9b1c1c", borderRadius: 6, fontSize: 13, border: "1px solid #f8b4b4" }}>
                  {teaFormError}
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                    Tea Name *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Darjeeling First Flush FTGFOP1"
                    value={teaForm.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setTeaForm((prev) => ({
                        ...prev,
                        name,
                        slug: editingTea ? prev.slug : name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
                      }));
                    }}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d9d4c8" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                    Category *
                  </label>
                  <select
                    value={teaForm.tea_category}
                    onChange={(e) => setTeaForm({ ...teaForm, tea_category: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d9d4c8", background: "#fff" }}
                  >
                    <option value="black">Black Tea</option>
                    <option value="green">Green Tea</option>
                    <option value="white">White Tea</option>
                    <option value="oolong">Oolong Tea</option>
                    <option value="chai_blend">Chai Blend</option>
                    <option value="herbal">Herbal Infusion</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                    Origin Estate *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Risheehat / Arya"
                    value={teaForm.origin_estate}
                    onChange={(e) => setTeaForm({ ...teaForm, origin_estate: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d9d4c8" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                    Region *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Darjeeling"
                    value={teaForm.region}
                    onChange={(e) => setTeaForm({ ...teaForm, region: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d9d4c8" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                    Grade &amp; Flush *
                  </label>
                  <div style={{ display: "flex", gap: 4 }}>
                    <input
                      type="text"
                      required
                      placeholder="Grade"
                      value={teaForm.grade}
                      onChange={(e) => setTeaForm({ ...teaForm, grade: e.target.value })}
                      style={{ width: "50%", padding: "8px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #d9d4c8" }}
                    />
                    <input
                      type="text"
                      required
                      placeholder="Flush"
                      value={teaForm.flush}
                      onChange={(e) => setTeaForm({ ...teaForm, flush: e.target.value })}
                      style={{ width: "50%", padding: "8px 8px", fontSize: 12, borderRadius: 6, border: "1px solid #d9d4c8" }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                  Tasting Profile Description *
                </label>
                <textarea
                  required
                  rows={2}
                  placeholder="Sensory tasting notes, harvesting method, and altitude."
                  value={teaForm.description}
                  onChange={(e) => setTeaForm({ ...teaForm, description: e.target.value })}
                  style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d9d4c8" }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                    Base Cost / kg (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min={1}
                    value={teaForm.base_cost_per_kg_inr}
                    onChange={(e) => setTeaForm({ ...teaForm, base_cost_per_kg_inr: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d9d4c8", fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                    Min Batch (kg) *
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    required
                    min={0.5}
                    value={teaForm.min_batch_kg}
                    onChange={(e) => setTeaForm({ ...teaForm, min_batch_kg: Number(e.target.value) })}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d9d4c8" }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#444", marginBottom: 4 }}>
                    Tasting Notes (comma-separated)
                  </label>
                  <input
                    type="text"
                    placeholder="Muscatel, Orchid, Honey"
                    value={teaForm.tasting_notes_str}
                    onChange={(e) => setTeaForm({ ...teaForm, tasting_notes_str: e.target.value })}
                    style={{ width: "100%", padding: "8px 10px", fontSize: 13, borderRadius: 6, border: "1px solid #d9d4c8" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                <input
                  type="checkbox"
                  id="tea-published-checkbox"
                  checked={teaForm.is_published}
                  onChange={(e) => setTeaForm({ ...teaForm, is_published: e.target.checked })}
                />
                <label htmlFor="tea-published-checkbox" style={{ fontSize: 13, color: "#333", cursor: "pointer", fontWeight: 600 }}>
                  Publish this tea option immediately to Studio
                </label>
              </div>

              <div style={{ paddingTop: 16, borderTop: "1px solid #ede9df", display: "flex", justifyContent: "flex-end", gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setTeaModalOpen(false)}
                  style={{ padding: "8px 18px", borderRadius: 6, border: "1px solid #d9d4c8", background: "#ffffff", fontSize: 13, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTea}
                  style={{
                    padding: "8px 22px",
                    borderRadius: 6,
                    border: "none",
                    background: "#23483a",
                    color: "#ffffff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: savingTea ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {savingTea && <Loader2 size={14} className="spin-icon" />}
                  <span>{editingTea ? "Save Tea Option" : "Create Tea Option"}</span>
                </button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {/* Publishing Blockers Modal */}
      {selectedBlockers && (
        <dialog
          open
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "#ffffff",
            border: "1px solid #d9d4c8",
            borderRadius: 8,
            padding: 24,
            maxWidth: 500,
            width: "90%",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            zIndex: 1000,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#9b1c1c" }}>
              Publishing Gate Blockers
            </h3>
            <button
              type="button"
              onClick={() => setSelectedBlockers(null)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>
          <p style={{ fontSize: 13, color: "#555", marginBottom: 12 }}>
            This item cannot be published to the public storefront until all following criteria are satisfied:
          </p>
          <ul style={{ paddingLeft: 20, margin: 0, fontSize: 13, color: "#8f2f2a" }}>
            {selectedBlockers.map((b, idx) => (
              <li key={idx} style={{ marginBottom: 6 }}>{b}</li>
            ))}
          </ul>
          <div style={{ marginTop: 20, textAlign: "right" }}>
            <button
              type="button"
              onClick={() => setSelectedBlockers(null)}
              style={{
                padding: "8px 16px",
                background: "#23483a",
                color: "#ffffff",
                border: "none",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Close
            </button>
          </div>
        </dialog>
      )}
    </div>
  );
}
