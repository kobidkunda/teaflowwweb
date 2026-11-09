import { getDb } from "@/lib/db";

export interface BlogPost {
  id: number;
  slug: string;
  title: string;
  excerpt: string;
  summary: string;
  content: string;
  cover_image_url: string | null;
  cover_media_id: number | null;
  status: "draft" | "published" | "archived";
  author_name: string;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  canonical_override: string | null;
  noindex: number;
  created_at: string;
  updated_at: string;
}

export interface BlogEditorialSpecs {
  reading_metrics: {
    word_count: number;
    character_count: number;
    reading_time_minutes: number;
  };
  headings_outline: Array<{ level: number; text: string; slug: string }>;
  detected_widgets: {
    charts_count: number;
    products_count: number;
    figures_count: number;
    tasting_radars_count: number;
    steep_guides_count: number;
    callouts_count: number;
    charts: Array<{ type: string; title: string }>;
    product_slugs: string[];
    figures: Array<{ caption?: string; url?: string }>;
  };
  cover_image: {
    url: string | null;
    is_set: boolean;
    recommended_dimensions: { width: number; height: number; aspect_ratio: string };
    min_dimensions: { width: number; height: number };
    supported_formats: string[];
    status: "valid" | "missing";
  };
  seo_analysis: {
    title_length: number;
    title_status: "optimal" | "too_short" | "too_long";
    description_length: number;
    description_status: "optimal" | "too_short" | "too_long" | "missing";
    has_cover: boolean;
    has_headings: boolean;
    word_count_grade: "in_depth" | "standard" | "stub";
    score_out_of_100: number;
  };
  widget_syntax_guide: {
    chart: string;
    product: string;
    figure: string;
    tasting_radar: string;
    steep_guide: string;
    callout: string;
  };
}

export function analyzeBlogSpecs(
  content: string = "",
  post?: Partial<BlogPost>
): BlogEditorialSpecs {
  const cleanContent = content || "";
  const words = cleanContent.trim().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  const charCount = cleanContent.length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  // Outline parser
  const headings: Array<{ level: number; text: string; slug: string }> = [];
  const lines = cleanContent.split("\n");
  for (const line of lines) {
    const match = line.match(/^(#{1,3})\s+(.+)$/);
    if (match) {
      const level = match[1].length;
      const text = match[2].trim().replace(/[*_`]/g, "");
      const slug = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, "")
        .replace(/[\s_-]+/g, "-");
      headings.push({ level, text, slug });
    }
  }

  // Detect widgets
  const charts: Array<{ type: string; title: string }> = [];
  const productSlugs: string[] = [];
  const figures: Array<{ caption?: string; url?: string }> = [];
  let tastingRadarsCount = 0;
  let steepGuidesCount = 0;
  let calloutsCount = 0;

  // Regex matches for fenced blocks
  const codeBlockRegex = /```([a-zA-Z0-9_-]+)\s*([\s\S]*?)```/g;
  let blockMatch: RegExpExecArray | null;
  while ((blockMatch = codeBlockRegex.exec(cleanContent)) !== null) {
    const tag = blockMatch[1].toLowerCase().trim();
    const rawBody = blockMatch[2].trim();

    try {
      if (tag === "chart") {
        const parsed = JSON.parse(rawBody);
        charts.push({
          type: parsed.type || "bar",
          title: parsed.title || "Interactive Chart",
        });
      } else if (tag === "product") {
        const parsed = JSON.parse(rawBody);
        if (parsed.slug) productSlugs.push(String(parsed.slug));
      } else if (tag === "figure") {
        const parsed = JSON.parse(rawBody);
        figures.push({ caption: parsed.caption, url: parsed.url });
      } else if (tag === "tasting-radar" || tag === "radar") {
        tastingRadarsCount++;
      } else if (tag === "steep-guide" || tag === "steep-timer") {
        steepGuidesCount++;
      } else if (tag === "callout") {
        calloutsCount++;
      }
    } catch {
      // If not strict JSON, count by tag
      if (tag === "chart") charts.push({ type: "bar", title: "Chart" });
      if (tag === "product") productSlugs.push("featured-tea");
      if (tag === "figure") figures.push({ caption: "Figure" });
      if (tag === "tasting-radar" || tag === "radar") tastingRadarsCount++;
      if (tag === "steep-guide" || tag === "steep-timer") steepGuidesCount++;
      if (tag === "callout") calloutsCount++;
    }
  }

  // Cover image checks
  const coverUrl = post?.cover_image_url || null;
  const isCoverSet = Boolean(coverUrl && coverUrl.trim().length > 0);

  // SEO analysis
  const title = post?.seo_title || post?.title || "";
  const titleLen = title.length;
  let titleStatus: "optimal" | "too_short" | "too_long" = "optimal";
  if (titleLen < 30) titleStatus = "too_short";
  else if (titleLen > 70) titleStatus = "too_long";

  const desc = post?.seo_description || post?.summary || post?.excerpt || "";
  const descLen = desc.length;
  let descStatus: "optimal" | "too_short" | "too_long" | "missing" = "optimal";
  if (descLen === 0) descStatus = "missing";
  else if (descLen < 80) descStatus = "too_short";
  else if (descLen > 180) descStatus = "too_long";

  let wordCountGrade: "in_depth" | "standard" | "stub" = "standard";
  if (wordCount >= 600) wordCountGrade = "in_depth";
  else if (wordCount < 200) wordCountGrade = "stub";

  // Score calculation
  let score = 50;
  if (isCoverSet) score += 15;
  if (titleStatus === "optimal") score += 10;
  if (descStatus === "optimal") score += 10;
  if (headings.length >= 2) score += 10;
  if (wordCountGrade === "in_depth") score += 5;

  return {
    reading_metrics: {
      word_count: wordCount,
      character_count: charCount,
      reading_time_minutes: readingTime,
    },
    headings_outline: headings,
    detected_widgets: {
      charts_count: charts.length,
      products_count: productSlugs.length,
      figures_count: figures.length,
      tasting_radars_count: tastingRadarsCount,
      steep_guides_count: steepGuidesCount,
      callouts_count: calloutsCount,
      charts,
      product_slugs: productSlugs,
      figures,
    },
    cover_image: {
      url: coverUrl,
      is_set: isCoverSet,
      recommended_dimensions: { width: 1200, height: 675, aspect_ratio: "16:9" },
      min_dimensions: { width: 800, height: 450 },
      supported_formats: ["image/jpeg", "image/png", "image/webp", "image/avif"],
      status: isCoverSet ? "valid" : "missing",
    },
    seo_analysis: {
      title_length: titleLen,
      title_status: titleStatus,
      description_length: descLen,
      description_status: descStatus,
      has_cover: isCoverSet,
      has_headings: headings.length > 0,
      word_count_grade: wordCountGrade,
      score_out_of_100: Math.min(100, Math.max(0, score)),
    },
    widget_syntax_guide: {
      chart: '```chart\n{"type": "bar", "title": "Elevation vs Aroma", "data": [{"label": "Assam", "value": 600}, {"label": "Darjeeling", "value": 6800}], "unit": "ft"}\n```',
      product: '```product\n{"slug": "darjeeling-first-flush", "highlight": "Artisanal Spring Harvest"}\n```',
      figure: '```figure\n{"url": "/images/orthodox-tea.jpg", "caption": "Hand-rolled orthodox whole leaf with tips", "credit": "Teafloww Archive"}\n```',
      tasting_radar: '```tasting-radar\n{"title": "Sensory Cupping Wheel", "scores": {"floral": 5, "fruity": 4, "malty": 2, "body": 3, "sweetness": 4, "earthy": 1}}\n```',
      steep_guide: '```steep-guide\n{"temp_c": 92, "time_seconds": 180, "dose_g": 2.5, "water_ml": 200, "steeps": 3, "tips": "Use freshly boiled spring water."}\n```',
      callout: '```callout\n{"type": "tip", "title": "Terroir Secret", "text": "High altitude slows leaf growth, concentrating essential aromatic esters."}\n```',
    },
  };
}

export interface UpsertBlogPostInput {
  id?: number;
  slug?: string;
  title: string;
  content: string;
  summary?: string;
  excerpt?: string;
  cover_image_url?: string;
  cover_media_id?: number | null;
  author_name?: string;
  status?: "draft" | "published" | "archived";
  published_at?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_override?: string | null;
  noindex?: boolean | number;
}

export function toBlogSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function listBlogPosts(opts: {
  status?: string;
  q?: string;
  limit?: number;
} = {}): BlogPost[] {
  const db = getDb();
  const clauses: string[] = [];
  const params: (string | number)[] = [];

  if (opts.status && opts.status !== "all") {
    clauses.push("status = ?");
    params.push(opts.status);
  }

  if (opts.q) {
    clauses.push("(title LIKE ? OR summary LIKE ? OR author_name LIKE ?)");
    params.push(`%${opts.q}%`, `%${opts.q}%`, `%${opts.q}%`);
  }

  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);

  return db
    .prepare(
      `SELECT * FROM blog_posts ${where} ORDER BY created_at DESC LIMIT ?`
    )
    .all(...params, limit) as BlogPost[];
}

export function getBlogPost(idOrSlug: string | number): BlogPost | null {
  const db = getDb();
  const isNumeric = typeof idOrSlug === "number" || /^\d+$/.test(String(idOrSlug));
  if (isNumeric) {
    const row = db
      .prepare("SELECT * FROM blog_posts WHERE id = ?")
      .get(Number(idOrSlug)) as BlogPost | undefined;
    if (row) return row;
  }
  const row = db
    .prepare("SELECT * FROM blog_posts WHERE slug = ?")
    .get(String(idOrSlug)) as BlogPost | undefined;
  return row ?? null;
}

export function upsertBlogPost(input: UpsertBlogPostInput): BlogPost {
  const db = getDb();
  const status = input.status ?? "draft";
  let slug = input.slug ? toBlogSlug(input.slug) : toBlogSlug(input.title);
  if (!slug) slug = `article-${Date.now()}`;

  let published_at = input.published_at;
  if (status === "published" && !published_at) {
    published_at = new Date().toISOString();
  }

  const summary = input.summary ?? input.excerpt ?? "";
  const excerpt = input.excerpt ?? input.summary ?? "";
  const author_name = input.author_name?.trim() || "Himalayan Tea House";
  const cover_image_url = input.cover_image_url?.trim() || null;
  const cover_media_id = input.cover_media_id ?? null;
  const noindexVal = input.noindex ? 1 : 0;

  // Check if an existing post is targeted by ID or slug
  const targetId = input.id;
  if (!targetId) {
    const existing = db.prepare("SELECT id FROM blog_posts WHERE slug = ?").get(slug) as { id: number } | undefined;
    if (existing) {
      throw new Error("An article with this slug already exists.");
    }
  }

  if (targetId) {
    // Check slug conflict with other posts
    const conflict = db
      .prepare("SELECT id FROM blog_posts WHERE slug = ? AND id != ?")
      .get(slug, targetId) as { id: number } | undefined;
    if (conflict) {
      throw new Error("An article with this slug already exists.");
    }

    db.prepare(`
      UPDATE blog_posts SET
        title = ?,
        slug = ?,
        summary = ?,
        excerpt = ?,
        content = ?,
        cover_image_url = ?,
        cover_media_id = ?,
        author_name = ?,
        status = ?,
        published_at = ?,
        seo_title = ?,
        seo_description = ?,
        canonical_override = ?,
        noindex = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      input.title.trim(),
      slug,
      summary,
      excerpt,
      input.content,
      cover_image_url,
      cover_media_id,
      author_name,
      status,
      published_at,
      input.seo_title ?? null,
      input.seo_description ?? null,
      input.canonical_override ?? null,
      noindexVal,
      targetId
    );

    return getBlogPost(targetId)!;
  }

  // Insert new
  const conflict = db.prepare("SELECT id FROM blog_posts WHERE slug = ?").get(slug);
  if (conflict) {
    throw new Error("An article with this slug already exists.");
  }

  const info = db.prepare(`
    INSERT INTO blog_posts (
      slug, title, summary, excerpt, content, cover_image_url, cover_media_id,
      author_name, status, published_at, seo_title, seo_description, canonical_override, noindex
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    slug,
    input.title.trim(),
    summary,
    excerpt,
    input.content,
    cover_image_url,
    cover_media_id,
    author_name,
    status,
    published_at,
    input.seo_title ?? null,
    input.seo_description ?? null,
    input.canonical_override ?? null,
    noindexVal
  );

  return getBlogPost(Number(info.lastInsertRowid))!;
}

export function deleteBlogPost(idOrSlug: string | number): boolean {
  const db = getDb();
  const existing = getBlogPost(idOrSlug);
  if (!existing) return false;
  const info = db.prepare("DELETE FROM blog_posts WHERE id = ?").run(existing.id);
  return info.changes > 0;
}
