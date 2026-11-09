import { subscriptionPolicy, saveSubscriptionPolicy, subscriptionList } from "@/lib/subscriptions/store";
import { HOME_TRIAL_MEDIA_GUIDANCE } from "@/lib/homeTrialsPresentation";
import { z } from "zod";
import { logger } from "@/lib/logger";
import {
  listProducts,
  getProductBySlug,
  getProduct,
  upsertProduct,
  upsertVariant,
  archiveProduct,
  deleteProduct,
  deleteVariant,
  deleteProductBySlug,
  deleteVariantBySku,
  listAllVariants,
  getProductSpecs,
  type Product,
} from "@/lib/products";
import {
  listCategories,
  getCategory,
  getCategoryBySlug,
  upsertCategory,
  deleteCategory,
  deleteCategoryBySlug,
} from "@/lib/categories";
import { listProductImages, upsertProductImage, deleteProductImage } from "@/lib/productImages";
import { listSliders, upsertSlider, updateSlider, deleteSlider } from "@/lib/sliders";
import { listCoupons, getCoupon, quoteCoupon, upsertCoupon, deleteCoupon } from "@/lib/coupons";
import { createDemoOrder } from "@/lib/checkout";
import { getOrderFull, listOrders, setDispatchStatusTx, cancelOrder, OrderTransitionError } from "@/lib/orders";
import { recordIntent, applyWebhook, PaymentError } from "@/lib/payments";
import { idempotent } from "@/lib/adminStore";
import {
  productSchema, variantSchema, categorySchema, productImageSchema,
  sliderSchema, sliderUpdateSchema, couponSchema,
  normalizeProductInput, normalizeVariantInput, normalizeInventoryInput,
} from "@/lib/validation";
import {
  listMedia,
  getMediaById,
  updateMediaMetadata,
  checkMediaReferences,
  deleteMediaUploadSync,
  upsertSitePlacement,
  getSitePlacement,
  listSitePlacements,
  deleteSitePlacement,
} from "@/lib/media";
import {
  listBlogPosts,
  getBlogPost,
  upsertBlogPost,
  deleteBlogPost,
  analyzeBlogSpecs,
} from "@/lib/blogs";
import {
  getStoreSettings,
  updateStoreSettings,
} from "@/lib/storeSettings";
import {
  getHomepageContent,
  getStorefrontHomepageContent,
  saveHomepageContent,
} from "@/lib/homepage";
import {
  listAdminUsers,
  upsertAdminUser,
  deleteAdminUser,
} from "@/lib/adminUsers";
import {
  validateImageUpload,
  generateCollisionResistantFilename,
  getUploadsDir,
  ALLOWED_MIME_TYPES,
  detectImageDimensions,
} from "@/lib/uploads";
import {
  getImageRequirements,
  getRequiredDimensionsForEntity,
  getCompatibleSlots,
  checkDimensionMatch,
} from "@/lib/imageRequirements";
import { getDb } from "@/lib/db";
import { updateInventoryStock } from "@/lib/inventory";
import {
  listAbandonedCarts,
  getAbandonedCartDetails,
  updateAbandonedCartStatus,
  getAbandonedCartsResourceSummary,
} from "@/lib/abandonedCarts";
import { purgeMockupData } from "@/lib/maintenance";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import {
  listPages,
  getPageBySlug,
  upsertPage,
  deletePage,
} from "@/lib/pages";
import {
  getContentBlock,
  getContentBlockRecord,
  listContentBlocks,
  upsertContentBlock,
  deleteContentBlock,
  getAnnouncementSettings,
  updateAnnouncementSettings,
  getSiteNavigation,
  updateSiteNavigation,
} from "@/lib/contentBlocks";
import { getDynamicSiteConfig } from "@/lib/seo/site";
import {
  listEmailTemplates,
  getEmailTemplate,
  updateEmailTemplate,
  renderEmailTemplate,
  generateEmailDraft,
  listLogoOptions,
  defaultEmailContext,
} from "@/lib/emailTemplates";
import { getSmtpStatus } from "@/lib/email";
import {
  listPlans as listBlendLabPlans,
  getPlanByCode as getBlendLabPlanByCode,
  upsertPlan as upsertBlendLabPlan,
  type PlanCode as BlendLabPlanCode,
} from "@/lib/blend-lab/plans";
import {
  listProjects as listBlendLabProjects,
  getProjectByIdOrPublicId as getBlendLabProjectByIdOrPublicId,
  updateProjectWorkflow as updateBlendLabProjectWorkflow,
} from "@/lib/blend-lab/projects";
import {
  listCoverage as listBlendLabCoverage,
  checkPincodeCoverage as checkBlendLabPincodeCoverage,
  upsertCoverage as upsertBlendLabCoverage,
  deleteCoverage as deleteBlendLabCoverage,
} from "@/lib/blend-lab/coverage";
import {
  getBlendLabContent,
  updateBlendLabContent,
} from "@/lib/blend-lab/content";
import { TrialService } from "@/lib/trials/service";
import {
  TrialRevisionConflictError,
  TrialPublishGateError,
  TrialInvalidStateTransitionError,
  TrialWeightInvariantError,
  TrialNotFoundError,
  type AuditActor,
  type CreateTrialInput,
  type UpdateTrialInput,
  type ComponentInput,
  type AssetInput,
  type AssetStage,
} from "@/lib/trials/types";
import { validateComponentInvariant } from "@/lib/trials/validation";

/**
 * Model Context Protocol (MCP) Server Implementation: 100% Capabilities
 * - Tools (Complete catalog, admin, blogs, settings, homepage, staff, orders, payments tools)
 * - Resources (Catalog, categories, status, coupons, settings, homepage, blogs + URI templates)
 * - Prompts (Sommelier recommendations, order inquiries, steeping guides, restock audits, campaign planning, blog drafting)
 * - Logging (RFC 5424 log level control: debug, info, notice, warning, error, critical, alert, emergency)
 * - Completion (Autocomplete for slugs, categories, coupons, usernames, settings keys, prompt arguments)
 *
 * All handlers delegate directly to src/lib service functions (single SQL owner).
 * No raw SQL lives here or in the /mcp route.
 */

export class McpError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

function parse<T>(schema: z.ZodType<T>, args: unknown): T {
  const parsed = schema.safeParse(args ?? {});
  if (!parsed.success) throw new McpError(-32602, "Please check the tool arguments and try again.");
  return parsed.data;
}

/** Map service-layer failures to tool error codes with generic messages. */
function serviceError(error: unknown): never {
  logger.error("MCP Service Error: " + (error instanceof Error ? error.message : String(error)));
  if (error instanceof McpError) throw error;
  const msg = error instanceof Error ? error.message : "";
  if (error instanceof TrialRevisionConflictError || /revision conflict/i.test(msg)) {
    throw new McpError(-32009, "Conflict: revision mismatch");
  }
  if (error instanceof TrialPublishGateError || /publication block|cannot publish trial/i.test(msg)) {
    throw new McpError(-32009, msg || "Trial cannot be published due to unresolved gate blockers.");
  }
  if (error instanceof TrialInvalidStateTransitionError || /invalid.*state transition/i.test(msg)) {
    throw new McpError(-32009, msg || "This trial lifecycle state transition is not allowed.");
  }
  if (error instanceof TrialWeightInvariantError || /weight invariant/i.test(msg)) {
    throw new McpError(-32602, msg || "Kit components must satisfy the 4x50g=200g net weight invariant.");
  }
  if (error instanceof TrialNotFoundError || /trial.*not found/i.test(msg)) {
    throw new McpError(-32004, "Trial not found");
  }
  if (/alt_text|requires asset_url|asset requires/i.test(msg)) {
    throw new McpError(-32602, msg);
  }
  if (typeof (error as { mcpCode?: number })?.mcpCode === "number") {
    throw new McpError((error as { mcpCode: number }).mcpCode, msg || "Domain service error.");
  }
  if (/not found/i.test(msg)) throw new McpError(-32004, "The requested record was not found.");
  if (/Original MRP|valid Original MRP/i.test(msg)) throw new McpError(-32602, msg.slice(0, 300) || "Please check the MRP value and try again.");
  if (error instanceof OrderTransitionError) throw new McpError(-32009, msg || "This status change is not allowed.");
  if (/cannot be deleted|is in use|at least one active root/i.test(msg)) throw new McpError(-32009, msg || "This record cannot be deleted.");
  if (/already exists/i.test(msg)) throw new McpError(-32009, msg || "A record with this identifier already exists.");
  if (error instanceof PaymentError) throw new McpError(-32602, "Please check the payment details and try again.");
  throw new McpError(-32603, "The tool call could not be completed.");
}

const listProductsArgs = z.object({
  q: z.string().max(100).optional(),
  category: z.string().max(40).optional(),
  featured: z.boolean().optional(),
  status: z.enum(["all", "published", "draft", "archived"]).optional(),
});
const getProductArgs = z.object({ slug: z.string().min(1).max(120) });
const activeOnlyArgs = z.object({ activeOnly: z.boolean().optional() });
const listSlidersArgs = z.object({
  activeOnly: z.boolean().optional(),
  page_target: z.enum(["home", "shop", "all"]).optional(),
  category_slug: z.string().optional(),
});
const validateCouponArgs = z.object({
  code: z.string().min(1).max(24),
  subtotalPaise: z.number().int().min(0),
});
const deleteEntityArgs = z.object({
  entity: z.enum(["product", "variant", "category", "product_image", "slider", "coupon", "blog", "user", "site_placement", "page", "content_block"]),
  id: z.union([z.string(), z.number()]),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});
const getProductSpecsArgs = z.object({
  slug: z.string().max(120).optional(),
  id: z.number().int().positive().optional(),
  slugOrId: z.union([z.string().max(120), z.number().int().positive()]).optional(),
});
const deleteProductArgs = z.object({
  id: z.number().int().positive().optional(),
  slug: z.string().max(120).optional(),
  idOrSlug: z.union([z.string().max(120), z.number().int().positive()]).optional(),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
  archive: z.boolean().optional(),
  archive_if_referenced: z.boolean().optional(),
});
const listVariantsArgs = z.object({
  product_id: z.number().int().positive().optional(),
});
const updateInventoryArgs = z.object({
  product: z.union([z.number().int().positive(), z.string().trim().min(1).max(120)]).optional(),
  sku: z.string().trim().min(1).max(30).optional(),
  variantId: z.number().int().positive().optional(),
  quantity: z.number().int().min(0).max(999999),
  idempotencyKey: z.string().uuid().optional(),
}).refine(
  (v) => v.product !== undefined || v.sku !== undefined || v.variantId !== undefined,
  { message: "Either product, sku, or variantId is required." }
);
const deleteVariantArgs = z.object({
  id: z.number().int().positive().optional(),
  sku: z.string().max(30).optional(),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});
const getCategoryArgs = z.object({
  slug: z.string().max(100).optional(),
  id: z.number().int().positive().optional(),
  slugOrId: z.union([z.string().max(100), z.number().int().positive()]).optional(),
});
const deleteCategoryArgs = z.object({
  id: z.number().int().positive().optional(),
  slug: z.string().max(100).optional(),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});
const listProductImagesArgs = z.object({
  product_id: z.number().int().positive(),
});
const deleteProductImageArgs = z.object({
  id: z.number().int().positive(),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});
const deleteSliderArgs = z.object({
  id: z.number().int().positive(),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});
const getCouponArgs = z.object({
  code: z.string().min(1).max(24),
});
const deleteCouponArgs = z.object({
  code: z.string().min(1).max(24),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});
const getSitePlacementArgs = z.object({
  section_key: z.string().min(1).max(80),
});
const deleteSitePlacementArgs = z.object({
  section_key: z.string().min(1).max(80),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});
const createDemoOrderArgs = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  address: z.string().min(1).max(500),
  phone: z.string().max(30).optional(),
  couponCode: z.string().max(24).optional(),
  idempotencyKey: z.string().uuid(),
  items: z.array(
    z.object({
      variantId: z.number().int().positive(),
      quantity: z.number().int().positive(),
    })
  ).min(1),
});
const getOrderArgs = z.object({ orderId: z.string().min(1).max(64) });
const listOrdersArgs = z.object({
  paymentStatus: z.enum(["unpaid", "payment_pending", "paid", "payment_failed", "refunded"]).optional(),
  dispatchStatus: z.enum(["unfulfilled", "preparing", "shipped", "delivered", "cancelled", "returned"]).optional(),
  cursor: z.string().max(64).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
const setDispatchArgs = z.object({
  orderId: z.string().min(1).max(64),
  to: z.enum(["unfulfilled", "preparing", "shipped", "delivered", "cancelled", "returned"]),
  idempotencyKey: z.string().uuid().optional(),
});
const cancelOrderArgs = z.object({
  orderId: z.string().min(1).max(64),
  actor: z.string().max(40).optional(),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});
const recordIntentArgs = z.object({
  orderId: z.string().min(1).max(64),
  amountPaise: z.number().int().min(0),
  idempotencyKey: z.string().uuid(),
  gateway: z.string().max(40).optional(),
  gatewayPaymentId: z.string().min(1).max(200).optional(),
});
const webhookArgs = z.object({
  gatewayPaymentId: z.string().min(1).max(200),
  status: z.string().min(1).max(40),
  signature: z.string().min(1).max(512),
  amountPaise: z.number().int().min(0).optional(),
});

const listMediaArgs = z.object({
  cursor: z.number().int().min(0).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  search: z.string().max(100).optional(),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]).optional(),
});

const uploadMediaArgs = z.object({
  filename: z.string().min(1).max(200),
  base64_data: z.string().min(1).optional(),
  base64Data: z.string().min(1).optional(),
  binary_data: z.union([z.string(), z.array(z.number()), z.any()]).optional(),
  binaryData: z.union([z.string(), z.array(z.number()), z.any()]).optional(),
  image_url: z.string().min(1).max(1000).optional(),
  imageUrl: z.string().min(1).max(1000).optional(),
  url: z.string().min(1).max(1000).optional(),
  source_url: z.string().min(1).max(1000).optional(),
  alt_text: z.string().max(300).optional(),
  altText: z.string().max(300).optional(),
  caption: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).optional(),
  sortOrder: z.number().int().min(0).optional(),
  idempotencyKey: z.string().uuid().optional(),
}).refine(
  (data) => !!(data.base64_data || data.base64Data || data.binary_data || data.binaryData || data.image_url || data.imageUrl || data.url || data.source_url),
  "Either base64_data, binary_data, or image_url must be provided."
);

const replaceImageArgs = z.object({
  media_id: z.number().int().positive().optional(),
  id: z.number().int().positive().optional(),
  base64_data: z.string().optional(),
  base64Data: z.string().optional(),
  binary_data: z.union([z.string(), z.array(z.number()), z.any()]).optional(),
  binaryData: z.union([z.string(), z.array(z.number()), z.any()]).optional(),
  image_url: z.string().optional(),
  imageUrl: z.string().optional(),
  url: z.string().optional(),
  filename: z.string().max(200).optional(),
  alt_text: z.string().max(300).optional(),
  caption: z.string().max(500).optional(),
});

const updateMetadataArgs = z.object({
  id: z.number().int().positive(),
  alt_text: z.string().max(300).optional(),
  caption: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).optional(),
});

const associateMediaArgs = z.object({
  media_id: z.number().int().positive(),
  entity_type: z.enum(["product", "category", "slider", "site_placement", "blog", "page"]),
  entity_id: z.union([z.number().int(), z.string().min(1)]),
  slot: z.enum(["bg", "fg", "hero", "cover"]).optional(),
  target: z.enum(["bg", "fg", "hero", "cover"]).optional(),
  is_primary: z.boolean().optional(),
});

const deleteMediaArgs = z.object({
  id: z.number().int().positive(),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});

const getImageRequirementsArgs = z.object({
  entity_type: z.enum(["product", "category", "slider", "site_placement", "blog", "page"]).optional(),
  section_key: z.string().max(80).optional(),
});

// Content Pages & Text Block Argument Schemas
const listPagesArgs = z.object({
  publishedOnly: z.boolean().optional(),
});

const getPageArgs = z.object({
  slug: z.string().min(1).max(120),
});

const upsertPageMcpArgs = z.object({
  slug: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  eyebrow: z.string().max(200).optional(),
  headline: z.string().max(300).optional(),
  subtitle: z.string().max(500).optional(),
  hero_image_url: z.string().max(500).optional(),
  heroImageUrl: z.string().max(500).optional(),
  hero_media_id: z.number().int().positive().nullable().optional(),
  heroMediaId: z.number().int().positive().nullable().optional(),
  body_markdown: z.string().optional(),
  bodyMarkdown: z.string().optional(),
  content: z.string().optional(),
  sections: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional(),
  sections_json: z.union([z.string(), z.array(z.record(z.string(), z.unknown()))]).optional(),
  meta_title: z.string().max(200).optional(),
  metaTitle: z.string().max(200).optional(),
  meta_description: z.string().max(400).optional(),
  metaDescription: z.string().max(400).optional(),
  is_published: z.union([z.boolean(), z.number()]).optional(),
  isPublished: z.union([z.boolean(), z.number()]).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

const deletePageArgs = z.object({
  slug: z.string().max(120).optional(),
  id: z.number().int().positive().optional(),
  slugOrId: z.union([z.string().max(120), z.number().int().positive()]).optional(),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});

const getTextBlockArgs = z.object({
  key: z.string().min(1).max(120),
  fallback: z.string().optional(),
});

const updateTextBlockArgs = z.object({
  key: z.string().min(1).max(120),
  content: z.string(),
  contentType: z.enum(["text", "markdown", "html", "json"]).optional(),
  content_type: z.enum(["text", "markdown", "html", "json"]).optional(),
  description: z.string().max(300).optional(),
});

const listTextBlocksArgs = z.object({
  prefix: z.string().max(100).optional(),
});

const deleteTextBlockArgs = z.object({
  key: z.string().min(1).max(120),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});

const updateAnnouncementMcpArgs = z.object({
  text: z.string().max(300).optional(),
  highlight: z.string().max(300).optional(),
  link_url: z.string().max(500).optional(),
  linkUrl: z.string().max(500).optional(),
  link_label: z.string().max(100).optional(),
  linkLabel: z.string().max(100).optional(),
  wholesale_label: z.string().max(100).optional(),
  wholesaleLabel: z.string().max(100).optional(),
  enabled: z.boolean().optional(),
});

const updateNavigationMcpArgs = z.object({
  brand: z.string().max(100).optional(),
  tagline: z.string().max(200).optional(),
  header_links: z.array(z.object({ label: z.string(), href: z.string(), highlight: z.boolean().optional() })).optional(),
  headerLinks: z.array(z.object({ label: z.string(), href: z.string(), highlight: z.boolean().optional() })).optional(),
  footer_links: z.array(z.object({ label: z.string(), href: z.string() })).optional(),
  footerLinks: z.array(z.object({ label: z.string(), href: z.string() })).optional(),
  footer_text: z.string().max(500).optional(),
  footerText: z.string().max(500).optional(),
  footer_copyright: z.string().max(300).optional(),
  footerCopyright: z.string().max(300).optional(),
  footer_disclosure: z.string().max(500).optional(),
  footerDisclosure: z.string().max(500).optional(),
});

const updateFooterMcpArgs = z.object({
  tagline: z.string().max(300).optional(),
  copyright: z.string().max(300).optional(),
  badge: z.string().max(100).optional(),
  newsletter_title: z.string().max(200).optional(),
  newsletterTitle: z.string().max(200).optional(),
  newsletter_subtitle: z.string().max(400).optional(),
  newsletterSubtitle: z.string().max(400).optional(),
});

// Blend Lab MCP Schemas
const listBlendLabPlansArgs = z.object({
  activeOnly: z.boolean().optional(),
});

const getBlendLabPlanArgs = z.object({
  code: z.string().min(1).max(50),
});

const upsertBlendLabPlanArgs = z.object({
  code: z.enum(["MATCH_QUOTE", "QUALITY_AUDIT", "SIGNATURE"] as [BlendLabPlanCode, ...BlendLabPlanCode[]]),
  title: z.string().min(1).max(100).optional(),
  eyebrow: z.string().max(100).optional(),
  tagline: z.string().max(250).optional(),
  description: z.string().max(1000).optional(),
  totalPaise: z.number().int().min(0).max(10000000),
  taxRateBps: z.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
  highlighted: z.boolean().optional(),
  badge: z.string().max(50).optional().nullable(),
  buttonLabel: z.string().max(60).optional(),
  features: z.array(z.string().max(250)).optional(),
  exclusions: z.array(z.string().max(250)).optional(),
  entitlements: z
    .object({
      inboundShipments: z.number().int().min(0).max(10).optional(),
      outboundShipments: z.number().int().min(0).max(10).optional(),
      detailedPdf: z.boolean().optional(),
      developmentIncluded: z.boolean().optional(),
      includedRevisionRounds: z.number().int().min(0).max(10).optional(),
      includedTrialCandidates: z.number().int().min(0).max(10).optional(),
      turnaroundDays: z.number().int().min(1).max(90).optional(),
      sampleWeightGrams: z.number().int().min(10).max(5000).optional(),
    })
    .optional(),
});

const listBlendLabProjectsArgs = z.object({
  status: z.string().max(50).optional(),
  paymentState: z.string().max(50).optional(),
  planCode: z.string().max(50).optional(),
  search: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

const getBlendLabProjectArgs = z.object({
  idOrPublicId: z.string().min(1).max(100),
});

const updateBlendLabProjectArgs = z.object({
  idOrPublicId: z.string().min(1).max(100),
  workflowState: z.string().max(50).optional(),
  paymentState: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
});

const listBlendLabCoverageArgs = z.object({
  search: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  offset: z.number().int().min(0).optional(),
});

const checkBlendLabCoverageArgs = z.object({
  pincode: z.string().min(6).max(10),
});

const upsertBlendLabCoverageArgs = z.object({
  pincode: z.string().regex(/^[1-9][0-9]{5}$/, "Must be a 6-digit PIN code"),
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(100),
  carrier: z.string().max(100).optional(),
  estimatedDays: z.number().int().min(1).max(30).optional(),
  serviceable: z.boolean().optional(),
});

const deleteBlendLabCoverageArgs = z.object({
  pincode: z.string().min(6).max(10),
});

const updateBlendLabContentArgs = z.object({
  homeEyebrow: z.string().max(100).optional(),
  homeTitle: z.string().max(200).optional(),
  homeDescription: z.string().max(1000).optional(),
  heroEyebrow: z.string().max(100).optional(),
  heroTitle: z.string().max(200).optional(),
  heroDescription: z.string().max(1000).optional(),
  heroImage: z
    .object({
      imageUrl: z.string().min(1).max(500),
      altText: z.string().max(300).optional(),
      title: z.string().max(200).optional(),
      subtitle: z.string().max(300).optional(),
      ctaLabel: z.string().max(100).optional(),
      ctaHref: z.string().max(300).optional(),
      mediaId: z.number().int().positive().optional().nullable(),
    })
    .optional(),
  homeImage: z
    .object({
      imageUrl: z.string().min(1).max(500),
      altText: z.string().max(300).optional(),
      title: z.string().max(200).optional(),
      subtitle: z.string().max(300).optional(),
      ctaLabel: z.string().max(100).optional(),
      ctaHref: z.string().max(300).optional(),
      mediaId: z.number().int().positive().optional().nullable(),
    })
    .optional(),
  faqs: z
    .array(
      z.object({
        question: z.string().min(1).max(300),
        answer: z.string().min(1).max(2000),
        category: z.string().max(100).optional(),
      })
    )
    .optional(),
});

const listBlogPostsArgs = z.object({
  status: z.enum(["draft", "published", "archived", "all"]).optional(),
  q: z.string().max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

const getBlogPostArgs = z.object({
  slugOrId: z.union([z.string().min(1).max(200), z.number().int().positive()]),
});

const upsertBlogPostArgs = z.object({
  id: z.number().int().positive().optional(),
  slug: z.string().max(200).optional(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  summary: z.string().max(1000).optional(),
  excerpt: z.string().max(500).optional(),
  cover_image_url: z.string().max(500).optional(),
  cover_media_id: z.number().int().positive().optional().nullable(),
  author_name: z.string().max(100).optional(),
  status: z.enum(["draft", "published", "archived"]).optional(),
  published_at: z.string().optional().nullable(),
  seo_title: z.string().max(200).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  canonical_override: z.string().max(500).optional().nullable(),
  noindex: z.union([z.boolean(), z.number()]).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

const deleteBlogPostArgs = z.object({
  idOrSlug: z.union([z.string().min(1).max(200), z.number().int().positive()]),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});

const updateSettingsArgs = z.object({
  store_name: z.string().min(1).max(100).optional(),
  "store-name": z.string().min(1).max(100).optional(),
  storeName: z.string().min(1).max(100).optional(),
  currency: z.string().min(1).max(10).optional(),
  currency_code: z.string().min(1).max(10).optional(),
  currencyCode: z.string().min(1).max(10).optional(),
  tax_rate_percent: z.number().min(0).max(100).optional(),
  gst_tax_rate_percent: z.number().min(0).max(100).optional(),
  taxRate: z.number().min(0).max(100).optional(),
  shipping_flat_fee_paise: z.number().int().min(0).optional(),
  shipping_fee_paise: z.number().int().min(0).optional(),
  shipping_flat_paise: z.number().int().min(0).optional(),
  shippingFlatFeePaise: z.number().int().min(0).optional(),
  free_shipping_threshold_paise: z.number().int().min(0).optional(),
  freeShippingThresholdPaise: z.number().int().min(0).optional(),
  contact_email: z.string().email().optional(),
  contactEmail: z.string().email().optional(),
  whatsapp_number: z.string().max(30).optional(),
  whatsappNumber: z.string().max(30).optional(),
});

const getHomepageArgs = z.object({
  storefrontOnly: z.boolean().optional(),
});

const updateHomepageArgs = z.object({
  content: z.record(z.string(), z.unknown()),
  idempotencyKey: z.string().uuid().optional(),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
  publish: z.boolean().optional(),
});

const upsertSitePlacementArgs = z.object({
  section_key: z.string().min(1).max(80),
  media_id: z.number().int().positive().optional().nullable(),
  image_url: z.string().max(500).optional(),
  alt_text: z.string().max(300).optional(),
  title: z.string().max(200).optional(),
  subtitle: z.string().max(300).optional(),
  cta_label: z.string().max(100).optional(),
  cta_href: z.string().max(300).optional(),
});

const upsertUserArgs = z.object({
  id: z.number().int().positive().optional(),
  username: z.string().min(2).max(50),
  email: z.string().email().optional().nullable(),
  password: z.string().min(8).optional(),
  role: z.enum(["root", "admin"]).optional(),
  is_active: z.union([z.boolean(), z.number()]).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

const deleteUserArgs = z.object({
  id: z.number().int().positive(),
  confirm: z.boolean().optional(),
  confirmed: z.boolean().optional(),
});

const listAbandonedCartsArgs = z.object({
  status: z.enum(["all", "active", "abandoned", "contacted", "converted", "ignored"]).default("all"),
  has_phone: z.boolean().optional(),
  limit: z.number().int().min(1).max(100).default(50),
  cursor: z.string().optional(),
});

const getAbandonedCartDetailsArgs = z.object({
  cart_id: z.string().min(1),
});

const updateAbandonedCartStatusArgs = z.object({
  cart_id: z.string().min(1),
  status: z.enum(["abandoned", "contacted", "converted", "ignored"]),
  notes: z.string().max(500).optional(),
  idempotencyKey: z.string().uuid().optional(),
});

const uuidProp = { type: "string", format: "uuid" };

export type ToolAnnotations = {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
};

export type ToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: ToolAnnotations;
  run: (args: unknown) => unknown;
};

const productUpsertInputSchema = {
  type: "object",
  properties: {
    id: { type: "integer", description: "Product numeric ID (for editing existing products)" },
    slug: { type: "string", description: "Product slug identifier (auto-generated from name if omitted)" },
    idOrSlug: { type: ["integer", "string"], description: "Product numeric ID or slug" },
    name: { type: "string", description: "Display name of the tea" },
    price: { type: "number", description: "Product price in Rupees (₹), e.g. 199" },
    price_paise: { type: "integer", description: "Product price in paise (e.g. 19900 for ₹199)" },
    price_inr: { type: "number", description: "Product price in INR (e.g. 199)" },
    stock: { type: "integer", description: "Variant stock / inventory count" },
    inventory: { type: "integer", description: "Inventory count (alias for stock)" },
    category: { type: "string", description: "Tea category name or slug" },
    category_id: { type: ["integer", "null"], minimum: 1, description: "Existing category ID; null removes the category assignment" },
    ingredients: { type: ["string", "array"], items: { type: "string" }, description: "Verified ingredients, as text or a list" },
    verified_origin: { type: "string", description: "Verified origin provenance details" },
    origin: { type: "string", description: "Origin / Region (e.g. Darjeeling, West Bengal, India)" },
    estate: { type: "string", description: "Tea estate name" },
    flush: { type: "string", description: "Harvest flush (e.g. First Flush, Second Flush)" },
    harvest_date: { type: "string", description: "Harvest season / date" },
    description: { type: "string", description: "Complete editorial product description" },
    tasting_notes: { type: "string", description: "Sensory tasting notes" },
    status: { type: "string", enum: ["published", "draft", "archived"], description: "Publication status ('published', 'draft', 'archived')" },
    pdf_url: { type: ["string", "null"], description: "URL or path of the attached PDF document (e.g. tasting sheet, harvest certificate)" },
    pdf_title: { type: ["string", "null"], description: "Display title for the attached PDF document (e.g. 'Estate Harvest & Cupping Dossier')" },
    publish: { type: "boolean", description: "Convenience flag: true to mark product published" },
    published: { type: "boolean", description: "Convenience flag: true to mark product published" },
    draft: { type: "boolean", description: "Draft flag (true to mark as draft, false to publish)" },
    is_draft: { type: "boolean", description: "Draft flag (true/1 to mark as draft, false/0 to publish)" },
    steeping: { type: "object", description: "Nested steeping guide object (brew_temp, brew_seconds, leaf_dose_grams, water_ml, steep_count, steep_instructions)" },
    cupping: { type: "object", description: "Nested cupping/sensory object (flavorScores, tasting_notes, aroma_tags, dryLeaf, liquor, wetLeaf)" },
    terroir: { type: "object", description: "Nested terroir/provenance object (origin, verified_origin, estate, flush, harvest_date, elevation_feet, etc.)" },
    provenance: { type: "object", description: "Alias for terroir object" },
    ingredients_public: { type: "string", description: "Public verified ingredient declaration" },
    floral: { type: "integer", minimum: 0, maximum: 5, description: "Floral cupping score (0-5)" },
    fruity: { type: "integer", minimum: 0, maximum: 5, description: "Fruity cupping score (0-5)" },
    malty: { type: "integer", minimum: 0, maximum: 5, description: "Malty cupping score (0-5)" },
    body: { type: "integer", minimum: 0, maximum: 5, description: "Body cupping score (0-5)" },
    sweetness: { type: "integer", minimum: 0, maximum: 5, description: "Sweetness cupping score (0-5)" },
    earthy: { type: "integer", minimum: 0, maximum: 5, description: "Earthy cupping score (0-5)" },
    aroma_tags: { type: "array", items: { type: "string" }, description: "Array of aroma tags" },
    dry_leaf_appearance: { type: "string" },
    dry_leaf_grade: { type: "string" },
    dry_leaf_aroma: { type: "string" },
    liquor_hue_hex: { type: "string" },
    liquor_hue_name: { type: "string" },
    liquor_clarity: { type: "string" },
    liquor_body: { type: "string" },
    wet_leaf_aroma: { type: "string" },
    wet_leaf_oxidation: { type: "string" },
    brew_temp: { type: "integer" },
    brew_seconds: { type: "integer" },
    leaf_dose_grams: { type: "number" },
    water_ml: { type: "integer" },
    steep_count: { type: "integer" },
    steep_instructions: { type: "string" },
    elevation_feet: { type: "integer" },
    elevation_display: { type: "string" },
    lot_number: { type: "string" },
    cultivar: { type: "string" },
    estate_story: { type: "string" },
    tea_moments: {
      description: "Curated Tea Moments content. Omit to preserve; null to clear. Images must use site-relative paths and include image_alt.",
      anyOf: [{ type: "null" }, { type: "object", additionalProperties: false, properties: {
        headline: { type: "string", maxLength: 120 }, introduction: { type: "string", maxLength: 1200 },
        occasion: { type: "string", maxLength: 300 }, serving_suggestion: { type: "string", maxLength: 300 },
        food_pairing: { type: "string", maxLength: 300 }, image_url: { type: "string", maxLength: 500 }, image_alt: { type: "string", maxLength: 300 },
      } }],
    },
    featured: { type: ["boolean", "integer"], enum: [true, false, 0, 1] },
    seo_title: { type: ["string", "null"], maxLength: 200 },
    seo_description: { type: ["string", "null"], maxLength: 500 },
    canonical_override: { type: ["string", "null"], maxLength: 500 },
    noindex: { type: ["boolean", "integer"], enum: [true, false, 0, 1] },
    variants: {
      type: "array",
      description: "Array of product variants with sku, grams, price_paise/price, compare_at_price_paise/mrp (Original MRP discount), stock/inventory, packaging_format, servings. Omitted MRP preserves the stored value; null clears it.",
      items: {
        type: "object",
        properties: {
          sku: { type: "string" },
          packaging_format: { type: "string" },
          grams: { type: "integer" },
          price_paise: { type: "integer" },
          price: { type: "number" },
          compare_at_price_paise: { type: ["integer", "null"], description: "Strike-through Original MRP in paise (>= price). Null clears the discount." },
          mrp_inr: { type: "number", description: "Alias for the Original MRP in Rupees" },
          mrp: { type: "number", description: "Alias for the Original MRP in Rupees" },
          stock: { type: "integer" },
          inventory: { type: "integer" },
          servings: { type: "integer" }
        }
      }
    },
    images: {
      type: "array",
      description: "Array of product gallery images with url, alt_text, sort_order, is_primary and optional variant_skus (multiple pack SKUs; empty means shared).",
      items: {
        type: "object",
        properties: {
          url: { type: "string" },
          alt_text: { type: "string" },
          sort_order: { type: "integer" },
          is_primary: { type: "integer" },
          variant_skus: { type: "array", items: { type: "string" } }
        }
      }
    },
    idempotencyKey: uuidProp,
  },
};

function handleProductUpsert(args: unknown) {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    throw new McpError(-32602, "Product details must be an object.");
  }
  const inputObj = (args ?? {}) as Record<string, unknown>;
  const raw = { ...inputObj };

  // Steeping guide aliases & nested objects
  const steepObj = (raw.steeping || raw.steeping_guide || raw.steeping_trial_only) as Record<string, unknown> | undefined;
  if (steepObj && typeof steepObj === "object") {
    if (raw.brew_temp === undefined) raw.brew_temp = steepObj.brew_temp ?? steepObj.brewTemp ?? steepObj.brew_temperature_C ?? steepObj.temp ?? steepObj.temperature;
    if (raw.brew_seconds === undefined) raw.brew_seconds = steepObj.brew_seconds ?? steepObj.brewSeconds ?? steepObj.steep_time_seconds ?? steepObj.seconds ?? steepObj.time;
    if (raw.leaf_dose_grams === undefined) raw.leaf_dose_grams = steepObj.leaf_dose_grams ?? steepObj.leafDoseGrams ?? steepObj.leaf_dose ?? steepObj.dose ?? steepObj.grams;
    if (raw.water_ml === undefined) raw.water_ml = steepObj.water_ml ?? steepObj.waterMl ?? steepObj.water ?? steepObj.volume;
    if (raw.steep_count === undefined) raw.steep_count = steepObj.steep_count ?? steepObj.steepCount ?? steepObj.re_steep_count ?? steepObj.steeps ?? steepObj.infusions;
    if (raw.steep_instructions === undefined) raw.steep_instructions = steepObj.steep_instructions ?? steepObj.steepInstructions ?? steepObj.instructions ?? steepObj.guide ?? steepObj.directions;
  }
  if (raw.brew_temp === undefined && raw.brewTemp !== undefined) raw.brew_temp = raw.brewTemp;
  if (raw.brew_seconds === undefined && raw.brewSeconds !== undefined) raw.brew_seconds = raw.brewSeconds;
  if (raw.leaf_dose_grams === undefined && raw.leafDoseGrams !== undefined) raw.leaf_dose_grams = raw.leafDoseGrams;
  if (raw.water_ml === undefined && raw.waterMl !== undefined) raw.water_ml = raw.waterMl;
  if (raw.steep_count === undefined && raw.steepCount !== undefined) raw.steep_count = raw.steepCount;
  if (raw.steep_instructions === undefined && raw.steepInstructions !== undefined) raw.steep_instructions = raw.steepInstructions;
  if (raw.steep_instructions === undefined && raw.instructions !== undefined) raw.steep_instructions = raw.instructions;

  // Cupping & sensory aliases & nested objects
  const cupObj = raw.cupping as Record<string, unknown> | undefined;
  if (cupObj && typeof cupObj === "object") {
    const scores = (cupObj.flavorScores || cupObj.scores) as Record<string, unknown> | undefined;
    if (scores && typeof scores === "object") {
      for (const k of ["floral", "fruity", "malty", "body", "sweetness", "earthy"]) {
        if (raw[k] === undefined && scores[k] !== undefined) raw[k] = scores[k];
      }
    }
    if (raw.tasting_notes === undefined) raw.tasting_notes = cupObj.tasting_notes ?? cupObj.tastingNotes;
    if (raw.aroma_tags === undefined) raw.aroma_tags = cupObj.aroma_tags ?? cupObj.aromaTags;
    const dry = cupObj.dryLeaf as Record<string, unknown> | undefined;
    if (dry && typeof dry === "object") {
      if (raw.dry_leaf_appearance === undefined) raw.dry_leaf_appearance = dry.appearance;
      if (raw.dry_leaf_grade === undefined) raw.dry_leaf_grade = dry.grade;
      if (raw.dry_leaf_aroma === undefined) raw.dry_leaf_aroma = dry.aroma;
    }
    const wet = cupObj.wetLeaf as Record<string, unknown> | undefined;
    if (wet && typeof wet === "object") {
      if (raw.wet_leaf_aroma === undefined) raw.wet_leaf_aroma = wet.aroma;
      if (raw.wet_leaf_oxidation === undefined) raw.wet_leaf_oxidation = wet.oxidation;
    }
    const liq = cupObj.liquor as Record<string, unknown> | undefined;
    if (liq && typeof liq === "object") {
      if (raw.liquor_hue_hex === undefined) raw.liquor_hue_hex = liq.hueHex ?? liq.hue_hex;
      if (raw.liquor_hue_name === undefined) raw.liquor_hue_name = liq.hueName ?? liq.hue_name;
      if (raw.liquor_clarity === undefined) raw.liquor_clarity = liq.clarity;
      if (raw.liquor_body === undefined) raw.liquor_body = liq.body;
    }
  }
  const sensoryObj = raw.sensory_ratings_verified as Record<string, unknown> | undefined;
  if (sensoryObj && typeof sensoryObj === "object") {
    for (const k of ["floral", "fruity", "malty", "body", "sweetness", "earthy"]) {
      if (raw[k] === undefined && sensoryObj[k] !== undefined && sensoryObj[k] !== null) raw[k] = sensoryObj[k];
    }
  }
  const dryObj = raw.dry_leaf as Record<string, unknown> | undefined;
  if (dryObj && typeof dryObj === "object") {
    if (raw.dry_leaf_appearance === undefined) raw.dry_leaf_appearance = dryObj.appearance ?? dryObj.appearance_verified;
    if (raw.dry_leaf_grade === undefined) raw.dry_leaf_grade = dryObj.grade ?? dryObj.grade_verified;
    if (raw.dry_leaf_aroma === undefined) raw.dry_leaf_aroma = dryObj.aroma ?? dryObj.dry_aroma_verified;
  }
  const wetObj = raw.wet_leaf as Record<string, unknown> | undefined;
  if (wetObj && typeof wetObj === "object") {
    if (raw.wet_leaf_aroma === undefined) raw.wet_leaf_aroma = wetObj.aroma ?? wetObj.infusion_aroma_verified;
    if (raw.wet_leaf_oxidation === undefined) raw.wet_leaf_oxidation = wetObj.oxidation ?? wetObj.oxidation_character_verified;
  }
  const liqObj = raw.liquor as Record<string, unknown> | undefined;
  if (liqObj && typeof liqObj === "object") {
    if (raw.liquor_hue_hex === undefined) raw.liquor_hue_hex = liqObj.hue_hex ?? liqObj.hue_hex_verified ?? liqObj.hueHex;
    if (raw.liquor_hue_name === undefined) raw.liquor_hue_name = liqObj.hue_name ?? liqObj.hue_name_verified ?? liqObj.hueName;
    if (raw.liquor_clarity === undefined) raw.liquor_clarity = liqObj.clarity ?? liqObj.clarity_and_body_verified;
    if (raw.liquor_body === undefined) raw.liquor_body = liqObj.body;
  }
  if (raw.tasting_notes === undefined && raw.tastingNotes !== undefined) raw.tasting_notes = raw.tastingNotes;
  if (raw.tasting_notes === undefined && raw.tasting_notes_summary_proposed !== undefined) raw.tasting_notes = raw.tasting_notes_summary_proposed;
  if (raw.aroma_tags === undefined && raw.aromaTags !== undefined) raw.aroma_tags = raw.aromaTags;
  if (raw.aroma_tags === undefined && raw.aroma_tags_proposed !== undefined) raw.aroma_tags = raw.aroma_tags_proposed;

  // Terroir & provenance aliases & nested objects
  const terroirObj = (raw.terroir || raw.provenance || raw.provenance_verified) as Record<string, unknown> | undefined;
  if (terroirObj && typeof terroirObj === "object") {
    if (raw.origin === undefined) raw.origin = terroirObj.origin ?? terroirObj.origin_region;
    if (raw.verified_origin === undefined) raw.verified_origin = terroirObj.verified_origin ?? terroirObj.origin_region ?? terroirObj.origin;
    if (raw.estate === undefined) raw.estate = terroirObj.estate ?? terroirObj.tea_estate;
    if (raw.flush === undefined) raw.flush = terroirObj.flush ?? terroirObj.flush_harvest_season;
    if (raw.harvest_date === undefined) raw.harvest_date = terroirObj.harvest_date ?? terroirObj.harvestDate;
    if (raw.elevation_feet === undefined) raw.elevation_feet = terroirObj.elevation_feet ?? terroirObj.elevationFeet ?? terroirObj.elevation;
    if (raw.elevation_display === undefined) raw.elevation_display = terroirObj.elevation_display ?? terroirObj.elevationDisplay;
    if (raw.lot_number === undefined) raw.lot_number = terroirObj.lot_number ?? terroirObj.lotNumber;
    if (raw.cultivar === undefined) raw.cultivar = terroirObj.cultivar;
    if (raw.estate_story === undefined) raw.estate_story = terroirObj.estate_story ?? terroirObj.estateStory;
  }
  if (raw.harvest_date === undefined && raw.harvestDate !== undefined) raw.harvest_date = raw.harvestDate;
  if (raw.elevation_feet === undefined && raw.elevationFeet !== undefined) raw.elevation_feet = raw.elevationFeet;
  if (raw.elevation_display === undefined && raw.elevationDisplay !== undefined) raw.elevation_display = raw.elevationDisplay;
  if (raw.lot_number === undefined && raw.lotNumber !== undefined) raw.lot_number = raw.lotNumber;
  if (raw.estate_story === undefined && raw.estateStory !== undefined) raw.estate_story = raw.estateStory;

  // Ingredients aliases & array of objects
  if (raw.ingredients === undefined && raw.ingredients_public !== undefined) {
    raw.ingredients = raw.ingredients_public;
  }
  if (Array.isArray(raw.ingredients)) {
    raw.ingredients = raw.ingredients.map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const n = obj.ingredient || obj.name || obj.item || obj.title;
        const pct = obj.percentage || obj.percentage_draft || obj.percent;
        if (n && pct !== undefined && pct !== null) return `${n} (${pct}%)`;
        if (n) return String(n);
      }
      return String(item);
    }).filter(Boolean).join(", ");
  }

  const db = getDb();
  let existingRecord: Record<string, unknown> | null = null;
  const targetId = raw.id !== undefined && raw.id !== null ? Number(raw.id)
    : (inputObj.idOrSlug !== undefined && /^\d+$/.test(String(inputObj.idOrSlug).trim()) ? Number(inputObj.idOrSlug) : undefined);
  const targetSlug = typeof raw.slug === "string" && raw.slug.trim() ? raw.slug.trim()
    : (typeof inputObj.idOrSlug === "string" && !/^\d+$/.test(String(inputObj.idOrSlug).trim()) ? String(inputObj.idOrSlug).trim() : undefined);

  if (targetId !== undefined && !isNaN(targetId)) {
    existingRecord = (db.prepare("SELECT * FROM products WHERE id = ?").get(targetId) as Record<string, unknown>) ?? null;
  }
  if (!existingRecord && targetSlug) {
    existingRecord = (db.prepare("SELECT * FROM products WHERE slug = ?").get(targetSlug) as Record<string, unknown>) ?? null;
  }

  if (!raw.slug && !raw.name && !existingRecord && targetId === undefined && !targetSlug) {
    throw new McpError(-32602, "Either id, slug, or name is required.");
  }

  const resolvedId = targetId ?? (existingRecord?.id ? Number(existingRecord.id) : undefined);

  const slug =
    (raw.slug as string) ||
    (existingRecord?.slug as string) ||
    (typeof raw.name === "string"
      ? raw.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
      : "tea");

  const name = (raw.name as string) || (existingRecord?.name as string) || slug;

  // Resolve category / category_id
  let categoryId = existingRecord?.category_id as number | null | undefined;
  let categoryName = (existingRecord?.category as string) || "";
  if (raw.category_id !== undefined) {
    categoryId = parse(z.object({ category_id: z.number().int().positive().nullable() }), raw).category_id;
    if (categoryId === null) {
      categoryName = "";
    } else {
      const cat = db.prepare("SELECT id, name FROM categories WHERE id = ?").get(categoryId) as { id: number; name: string } | undefined;
      if (!cat) throw new McpError(-32004, "Category not found.");
      categoryName = cat.name;
    }
  } else if (raw.category !== undefined) {
    categoryName = parse(z.string().trim().max(100), raw.category);
    categoryId = null;
  }
  if (raw.category_id === undefined && !categoryId && categoryName) {
    const cat = db.prepare("SELECT id, name FROM categories WHERE name = ? OR slug = ?").get(categoryName, categoryName.toLowerCase().replace(/[^a-z0-9]+/g, "-")) as { id: number; name: string } | undefined;
    if (cat) {
      categoryId = cat.id;
      categoryName = cat.name;
    }
  }

  // Handle draft status
  let status: string;
  if (raw.publish === true || raw.published === true || raw.draft === false || raw.is_draft === false || raw.is_draft === 0 || raw.status === "published" || raw.draft_status === "published" || raw.publication_status === "published" || raw.publication_status_requested === "published") {
    status = "published";
  } else if (raw.draft === true || raw.is_draft === true || raw.is_draft === 1 || raw.status === "draft" || raw.draft_status === "draft" || raw.publication_status === "draft" || raw.publication_status_requested === "draft") {
    status = "draft";
  } else if (raw.status) {
    status = String(raw.status);
  } else if (existingRecord?.status) {
    status = String(existingRecord.status);
  } else {
    status = "published";
  }

  const parseNum = (val: unknown): number | undefined => {
    if (val === undefined || val === null || val === "") return undefined;
    if (typeof val === "number" && !isNaN(val)) return val;
    if (typeof val === "string") {
      const match = val.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
      if (match) return Number(match[0]);
    }
    return undefined;
  };

  const rawStock = raw.stock !== undefined ? parseNum(raw.stock)
    : (raw.inventory !== undefined ? parseNum(raw.inventory)
    : undefined);
  const stock = rawStock !== undefined ? Math.max(0, Math.round(rawStock)) : undefined;

  const rawVerifiedOrigin = raw.verified_origin ?? raw.verifiedOrigin;
  let verifiedOrigin: string;
  if (rawVerifiedOrigin === true) {
    verifiedOrigin = (raw.origin as string) || (existingRecord?.origin as string) || "Verified Origin";
  } else if (rawVerifiedOrigin === false) {
    verifiedOrigin = "";
  } else if (rawVerifiedOrigin !== undefined && rawVerifiedOrigin !== null) {
    verifiedOrigin = String(rawVerifiedOrigin).trim();
  } else {
    verifiedOrigin = (existingRecord?.verified_origin as string) ?? "";
  }
  const origin = (raw.origin as string) ?? (existingRecord?.origin as string) ?? (verifiedOrigin || "");
  const ingredients = (raw.ingredients as string) ?? (raw.ingredients_public as string) ?? (existingRecord?.ingredients as string) ?? "";

  const payload: Record<string, unknown> = {
    id: resolvedId,
    slug,
    name,
    category: categoryName,
    category_id: categoryId,
    ingredients,
    verified_origin: verifiedOrigin,
    origin,
    estate: (raw.estate as string) ?? (existingRecord?.estate as string) ?? "",
    flush: (raw.flush as string) ?? (existingRecord?.flush as string) ?? "",
    harvest_date: (raw.harvest_date as string) ?? (existingRecord?.harvest_date as string) ?? "",
    description: (raw.description as string) ?? (existingRecord?.description as string) ?? "",
    tasting_notes: (raw.tasting_notes as string) ?? (existingRecord?.tasting_notes as string) ?? "",
    status,
    floral: parseNum(raw.floral) ?? existingRecord?.floral ?? 0,
    fruity: parseNum(raw.fruity) ?? existingRecord?.fruity ?? 0,
    malty: parseNum(raw.malty) ?? existingRecord?.malty ?? 0,
    body: parseNum(raw.body) ?? existingRecord?.body ?? 0,
    sweetness: parseNum(raw.sweetness) ?? existingRecord?.sweetness ?? 0,
    earthy: parseNum(raw.earthy) ?? existingRecord?.earthy ?? 0,
    aroma_tags: raw.aroma_tags ?? (existingRecord?.aroma_tags ? JSON.parse(String(existingRecord.aroma_tags)) : []),
    dry_leaf_appearance: raw.dry_leaf_appearance ?? existingRecord?.dry_leaf_appearance ?? "",
    dry_leaf_grade: raw.dry_leaf_grade ?? existingRecord?.dry_leaf_grade ?? "",
    dry_leaf_aroma: raw.dry_leaf_aroma ?? existingRecord?.dry_leaf_aroma ?? "",
    liquor_hue_hex: raw.liquor_hue_hex ?? existingRecord?.liquor_hue_hex ?? "#b36b3d",
    liquor_hue_name: raw.liquor_hue_name ?? existingRecord?.liquor_hue_name ?? "",
    liquor_clarity: raw.liquor_clarity ?? existingRecord?.liquor_clarity ?? "",
    liquor_body: raw.liquor_body ?? existingRecord?.liquor_body ?? "",
    wet_leaf_aroma: raw.wet_leaf_aroma ?? existingRecord?.wet_leaf_aroma ?? "",
    wet_leaf_oxidation: raw.wet_leaf_oxidation ?? existingRecord?.wet_leaf_oxidation ?? "",
    brew_temp: parseNum(raw.brew_temp) ?? existingRecord?.brew_temp ?? 90,
    brew_seconds: parseNum(raw.brew_seconds) ?? existingRecord?.brew_seconds ?? 180,
    leaf_dose_grams: parseNum(raw.leaf_dose_grams) ?? existingRecord?.leaf_dose_grams ?? 2.5,
    water_ml: parseNum(raw.water_ml) ?? existingRecord?.water_ml ?? 200,
    steep_count: parseNum(raw.steep_count) ?? existingRecord?.steep_count ?? 3,
    steep_instructions: raw.steep_instructions ?? existingRecord?.steep_instructions ?? "",
    elevation_feet: parseNum(raw.elevation_feet) ?? existingRecord?.elevation_feet ?? 0,
    elevation_display: raw.elevation_display ?? existingRecord?.elevation_display ?? "",
    lot_number: raw.lot_number ?? existingRecord?.lot_number ?? "",
    cultivar: raw.cultivar ?? existingRecord?.cultivar ?? "",
    estate_story: raw.estate_story ?? existingRecord?.estate_story ?? "",
    tea_moments: raw.tea_moments,
    featured: raw.featured ?? existingRecord?.featured ?? 0,
    price: raw.price,
    price_paise: raw.price_paise,
    price_inr: raw.price_inr,
    stock,
    inventory: stock,
    variants: raw.variants,
    images: raw.images,
    seo_title: raw.seo_title !== undefined ? raw.seo_title : existingRecord?.seo_title,
    seo_description: raw.seo_description !== undefined ? raw.seo_description : existingRecord?.seo_description,
    canonical_override: raw.canonical_override !== undefined ? raw.canonical_override : existingRecord?.canonical_override,
    noindex: raw.noindex !== undefined ? raw.noindex : existingRecord?.noindex,
    idempotencyKey: raw.idempotencyKey,
  };

  if (existingRecord && stock !== undefined && !raw.variants) {
    db.prepare("UPDATE variants SET stock = ? WHERE product_id = ?").run(stock, existingRecord.id);
  }

  const normalized = normalizeProductInput(payload);
  const parsed = productSchema.safeParse(normalized);
  if (!parsed.success) {
    throw new McpError(-32602, `Please check the tool arguments and try again: ${JSON.stringify(parsed.error.flatten())}`);
  }
  const result = upsertProduct(parsed.data);
  const prod = getProduct(result.id) ?? getProductBySlug(result.slug);
  const specs = prod?.specs ?? (prod ? getProductSpecs(prod) : undefined);
  return {
    ...result,
    inventory: prod?.inventory ?? (raw.stock !== undefined ? Number(raw.stock) : (raw.inventory !== undefined ? Number(raw.inventory) : 0)),
    product: prod,
    specs,
  };
}

const variantUpsertInputSchema = {
  type: "object",
  properties: {
    product_id: { type: "integer", description: "Product numeric ID" },
    product_slug: { type: "string", description: "Product slug identifier" },
    sku: { type: "string", description: "Variant SKU (e.g. DJ-SP-100G). Auto-generated if omitted." },
    grams: { type: "integer", description: "Net weight in grams (default: 100)" },
    price: { type: "number", description: "Price in Rupees (₹)" },
    price_paise: { type: "integer", description: "Price in paise" },
    price_inr: { type: "number", description: "Price in INR" },
    compare_at_price_paise: { type: ["integer", "null"], description: "Strike-through Original MRP in paise (must be empty or >= price). Null/empty clears the discount badge. Omitted preserves the stored MRP." },
    mrp_paise: { type: "integer", description: "Alias for compare_at_price_paise (paise)" },
    mrp_inr: { type: "number", description: "Alias for the Original MRP in Rupees (e.g. 249)" },
    mrp: { type: "number", description: "Alias for the Original MRP in Rupees (e.g. 249)" },
    stock: { type: "integer", description: "Stock inventory count" },
    inventory: { type: "integer", description: "Inventory count (alias for stock)" },
    packaging_format: { type: "string", description: "Packaging format: loose_leaf_pouch, luxury_tin, pyramid_bags" },
    servings: { type: "integer" },
    idempotencyKey: uuidProp,
  },
};

const VARIANT_MRP_KEYS = ["compare_at_price_paise", "mrp_paise", "mrp_inr", "mrp", "compare_at_price"] as const;

function resolveVariantMrp(
  original: Record<string, unknown>,
  normalized: Record<string, unknown>,
  pricePaise: number
): number | null | undefined {
  const provided = VARIANT_MRP_KEYS.some((k) => original[k] !== undefined);
  const resolved = normalized.compare_at_price_paise as number | null | undefined;
  if (!provided) return undefined; // preserve stored MRP
  if (resolved === undefined) {
    throw new McpError(-32602, "Enter the Original MRP as a non-negative amount (paise integer for *_paise, Rupees for mrp/mrp_inr), empty to clear, or omit to keep the stored MRP.");
  }
  if (resolved !== null && resolved < pricePaise) {
    throw new McpError(-32602, `Original MRP (₹${(resolved / 100).toFixed(2)}) is below the price (₹${(pricePaise / 100).toFixed(2)}). MRP must be empty or at least the selling price.`);
  }
  return resolved;
}

function handleVariantUpsert(args: unknown) {
  const original = (args ?? {}) as Record<string, unknown>;
  const raw = normalizeVariantInput(args);
  const provided = (...keys: string[]) => keys.some((k) => original[k] !== undefined);
  const db = getDb();
  let productId = raw.product_id ? Number(raw.product_id) : undefined;
  if (!productId && (raw.product_slug || raw.slug)) {
    const slugStr = String(raw.product_slug || raw.slug).trim();
    const p = db.prepare("SELECT id FROM products WHERE slug = ?").get(slugStr) as { id: number } | undefined;
    if (p) productId = p.id;
  }
  let existingVar: { id: number; product_id: number; grams: number; price_paise: number; compare_at_price_paise: number | null; stock: number; packaging_format: string; servings: number } | undefined;
  if (raw.sku) {
    existingVar = db.prepare("SELECT * FROM variants WHERE sku = ?").get(String(raw.sku)) as typeof existingVar;
    if (existingVar && !productId) {
      productId = existingVar.product_id;
    }
  }
  if (!productId) {
    throw new McpError(-32602, "Valid product_id or product_slug is required.");
  }

  let sku = raw.sku ? String(raw.sku).trim().toUpperCase() : undefined;
  if (!sku) {
    const prod = db.prepare("SELECT slug FROM products WHERE id = ?").get(productId) as { slug: string } | undefined;
    const prefix = (prod?.slug || "TEA").toUpperCase().replace(/[^A-Z0-9]/g, "-").slice(0, 16);
    const gramsVal = Number(raw.grams) || 100;
    sku = `${prefix}-${gramsVal}G`;
  }

  // Partial updates must never reset omitted fields: the normalizer fills
  // defaults for missing keys, so only honour values explicitly provided by
  // the caller and otherwise preserve the stored variant.
  const pricePaise = provided("price", "price_paise", "price_inr")
    ? Number(raw.price_paise)
    : (existingVar?.price_paise ?? 19900);
  const stockVal = provided("stock", "inventory")
    ? Number(raw.stock)
    : (existingVar?.stock ?? 50);
  const gramsVal = original.grams !== undefined
    ? Number(raw.grams)
    : (existingVar?.grams ?? 100);
  const servingsVal = original.servings !== undefined
    ? Number(raw.servings)
    : (existingVar?.servings ?? 50);
  const resolvedMrp = resolveVariantMrp(original, raw, pricePaise);
  const mrpPaise = resolvedMrp === undefined ? (existingVar?.compare_at_price_paise ?? null) : resolvedMrp;

  const payload = {
    ...raw,
    product_id: productId,
    sku,
    grams: gramsVal,
    price_paise: pricePaise,
    compare_at_price_paise: mrpPaise,
    stock: stockVal,
    packaging_format: provided("packaging_format") ? raw.packaging_format : (existingVar?.packaging_format ?? "loose_leaf_pouch"),
    servings: servingsVal,
  };
  return upsertVariant(parse(variantSchema, payload));
}

const categoryUpsertInputSchema = {
  type: "object",
  required: ["slug", "name"],
  properties: {
    slug: { type: "string" },
    name: { type: "string" },
    cover_image_url: { type: "string" },
    description: { type: "string" },
    sort_order: { type: "integer" },
    is_active: { type: "integer" },
    idempotencyKey: uuidProp,
  },
};

function handleCategoryUpsert(args: unknown) {
  const result = upsertCategory(parse(categorySchema, args));
  const reqDims = getRequiredDimensionsForEntity("category");
  return {
    ...result,
    required_dimensions: {
      recommended_width: reqDims.recommended_width,
      recommended_height: reqDims.recommended_height,
      aspect_ratio: reqDims.aspect_ratio,
      min_width: reqDims.min_width,
      min_height: reqDims.min_height,
      description: reqDims.description,
    },
  };
}

const productImageUpsertInputSchema = {
  type: "object",
  required: ["url"],
  properties: {
    product_id: { type: "integer" },
    product_slug: { type: "string" },
    url: { type: "string" },
    alt_text: { type: "string" },
    sort_order: { type: "integer" },
    is_primary: { type: "integer" },
    idempotencyKey: uuidProp,
  },
};

function handleProductImageUpsert(args: unknown) {
  const raw = (args ?? {}) as Record<string, unknown>;
  const db = getDb();
  let productId = raw.product_id ? Number(raw.product_id) : undefined;
  if (!productId && (raw.product_slug || raw.slug)) {
    const slugStr = String(raw.product_slug || raw.slug).trim();
    const p = db.prepare("SELECT id FROM products WHERE slug = ?").get(slugStr) as { id: number } | undefined;
    if (p) productId = p.id;
  }
  if (!productId) {
    throw new McpError(-32602, "Valid product_id or product_slug is required.");
  }
  const payload = {
    ...raw,
    product_id: productId,
  };
  const result = upsertProductImage(parse(productImageSchema, payload));
  const reqDims = getRequiredDimensionsForEntity("product");
  return {
    ...result,
    required_dimensions: {
      recommended_width: reqDims.recommended_width,
      recommended_height: reqDims.recommended_height,
      aspect_ratio: reqDims.aspect_ratio,
      min_width: reqDims.min_width,
      min_height: reqDims.min_height,
      description: reqDims.description,
    },
  };
}

const sliderUpsertInputSchema = {
  type: "object",
  required: ["title"],
  properties: {
    id: { type: "integer", description: "Optional slider ID when updating" },
    title: { type: "string", description: "Headline title" },
    image_url: { type: "string", description: "Background panoramic photography URL" },
    bg_image_url: { type: "string", description: "Alias for background image URL" },
    fg_image_url: { type: "string", description: "Foreground featured card photography URL" },
    card_image_url: { type: "string", description: "Alias for foreground card image URL" },
    card_enabled: { type: "integer", description: "Front featured card visibility: 1 to show, 0 to disable" },
    subtitle: { type: "string", description: "Editorial subtitle" },
    cta_label: { type: "string", description: "CTA button label / card title" },
    cta_href: { type: "string", description: "CTA target URL" },
    sort_order: { type: "integer", description: "Sort sequence order" },
    is_active: { type: "integer", description: "Active status (1 for active, 0 for hidden)" },
    starts_at: { type: "string", description: "Optional scheduled start ISO timestamp" },
    ends_at: { type: "string", description: "Optional scheduled end ISO timestamp" },
    media_id: { type: "integer", description: "Background media asset ID" },
    fg_media_id: { type: "integer", description: "Foreground card media asset ID" },
    card_tag: { type: "string", description: "Harvest lot / micro-lot tag (e.g. '2026 First Flush · Margaret's Hope')" },
    card_title: { type: "string", description: "Featured tea name heading on the card (e.g. 'Darjeeling First Flush')" },
    card_subtitle: { type: "string", description: "Elevation and terroir meta line (e.g. 'Single Estate · 6,800 ft')" },
    card_tasting_notes: { type: "string", description: "Tasting notes pill text (e.g. 'Muscatel • Wild Orchid • Crisp Finish')" },
    card_quote: { type: "string", description: "Provenance quote or tagline on the card (e.g. 'From Our Gardens to Your Cup')" },
    card_badge: { type: "string", description: "Badge over card photography (e.g. 'ESTATE HARVEST')" },
    card_cta_label: { type: "string", description: "Action button label on the card (e.g. 'View Harvest')" },
    card_cta_href: { type: "string", description: "Card destination URL (e.g. '/shop' or '/collections/darjeeling')" },
    chapter_label: { type: "string", description: "Bottom slider chapter tab label (e.g. '01. Darjeeling First Flush'). Defaults to numbered tea title if omitted." },
    page_target: { type: "string", enum: ["home", "shop", "all"], description: "Target storefront page: 'home' (homepage only), 'shop' (/shop catalog only), or 'all' (all pages). Defaults to 'home'." },
    category_slug: { type: "string", description: "Category filter scope (e.g. 'black', 'green', 'rare'). When viewing /shop, slider displays when this category filter is active." },
    idempotencyKey: uuidProp,
  },
};

const sliderUpdateInputSchema = {
  type: "object",
  required: ["id"],
  properties: {
    id: { type: "integer", description: "Numeric ID of the slider to update" },
    title: { type: "string", description: "Headline title" },
    image_url: { type: "string", description: "Background panoramic photography URL" },
    bg_image_url: { type: "string", description: "Alias for background image URL" },
    fg_image_url: { type: "string", description: "Foreground featured card photography URL" },
    card_image_url: { type: "string", description: "Alias for foreground card image URL" },
    card_enabled: { type: "integer", description: "Front featured card visibility: 1 to show, 0 to disable" },
    subtitle: { type: "string", description: "Editorial subtitle" },
    cta_label: { type: "string", description: "CTA button label / card title" },
    cta_href: { type: "string", description: "CTA target URL" },
    sort_order: { type: "integer", description: "Sort sequence order" },
    is_active: { type: "integer", description: "Active status (1 for active, 0 for hidden)" },
    starts_at: { type: "string", description: "Optional scheduled start ISO timestamp" },
    ends_at: { type: "string", description: "Optional scheduled end ISO timestamp" },
    media_id: { type: "integer", description: "Background media asset ID" },
    fg_media_id: { type: "integer", description: "Foreground card media asset ID" },
    card_tag: { type: "string", description: "Harvest lot / micro-lot tag (e.g. '2026 First Flush · Margaret's Hope')" },
    card_title: { type: "string", description: "Featured tea name heading on the card (e.g. 'Darjeeling First Flush')" },
    card_subtitle: { type: "string", description: "Elevation and terroir meta line (e.g. 'Single Estate · 6,800 ft')" },
    card_tasting_notes: { type: "string", description: "Tasting notes pill text (e.g. 'Muscatel • Wild Orchid • Crisp Finish')" },
    card_quote: { type: "string", description: "Provenance quote or tagline on the card (e.g. 'From Our Gardens to Your Cup')" },
    card_badge: { type: "string", description: "Badge over card photography (e.g. 'ESTATE HARVEST')" },
    card_cta_label: { type: "string", description: "Action button label on the card (e.g. 'View Harvest')" },
    card_cta_href: { type: "string", description: "Card destination URL (e.g. '/shop' or '/collections/darjeeling')" },
    chapter_label: { type: "string", description: "Bottom slider chapter tab label (e.g. '01. Darjeeling First Flush'). Defaults to numbered tea title if omitted." },
    page_target: { type: "string", enum: ["home", "shop", "all"], description: "Target storefront page: 'home' (homepage only), 'shop' (/shop catalog only), or 'all' (all pages). Defaults to 'home'." },
    category_slug: { type: "string", description: "Category filter scope (e.g. 'black', 'green', 'rare'). When viewing /shop, slider displays when this category filter is active." },
    idempotencyKey: uuidProp,
  },
};

function handleSliderUpsert(args: unknown) {
  const result = upsertSlider(parse(sliderSchema, args));
  const reqDims = getRequiredDimensionsForEntity("slider");
  const fgDims = getRequiredDimensionsForEntity("slider", "fg");
  return {
    ...result,
    required_dimensions: {
      recommended_width: reqDims.recommended_width,
      recommended_height: reqDims.recommended_height,
      aspect_ratio: reqDims.aspect_ratio,
      min_width: reqDims.min_width,
      min_height: reqDims.min_height,
      description: reqDims.description,
      background: {
        recommended: `${reqDims.recommended_width}x${reqDims.recommended_height}px (${reqDims.aspect_ratio})`,
        min: `${reqDims.min_width}x${reqDims.min_height}px`,
      },
      foreground: {
        recommended: `${fgDims.recommended_width}x${fgDims.recommended_height}px (${fgDims.aspect_ratio})`,
        min: `${fgDims.min_width}x${fgDims.min_height}px`,
      },
    },
  };
}

function handleSliderUpdate(args: unknown) {
  const parsedArgs = parse(
    z.object({
      id: z.number().int().positive(),
    }).passthrough(),
    args
  );
  const updateData = parse(sliderUpdateSchema, args);
  const updated = updateSlider(parsedArgs.id, updateData);
  if (!updated) throw new McpError(-32004, "Slider not found.");
  const reqDims = getRequiredDimensionsForEntity("slider");
  const fgDims = getRequiredDimensionsForEntity("slider", "fg");
  return {
    slider: updated,
    id: updated.id,
    required_dimensions: {
      recommended_width: reqDims.recommended_width,
      recommended_height: reqDims.recommended_height,
      aspect_ratio: reqDims.aspect_ratio,
      min_width: reqDims.min_width,
      min_height: reqDims.min_height,
      description: reqDims.description,
      background: {
        recommended: `${reqDims.recommended_width}x${reqDims.recommended_height}px (${reqDims.aspect_ratio})`,
        min: `${reqDims.min_width}x${reqDims.min_height}px`,
      },
      foreground: {
        recommended: `${fgDims.recommended_width}x${fgDims.recommended_height}px (${fgDims.aspect_ratio})`,
        min: `${fgDims.min_width}x${fgDims.min_height}px`,
      },
    },
  };
}

const couponUpsertInputSchema = {
  type: "object",
  required: ["code", "kind", "value"],
  properties: {
    code: { type: "string" },
    kind: { type: "string", enum: ["percent", "flat"] },
    value: { type: "integer" },
    min_order_paise: { type: "integer" },
    max_discount_paise: { type: "integer" },
    is_active: { type: "integer" },
    idempotencyKey: uuidProp,
  },
};

function handleCouponUpsert(args: unknown) {
  const input = parse(couponSchema, args);
  const { body, deduped } = idempotent("coupon", input.idempotencyKey, () => upsertCoupon(input));
  return { coupon: body, deduped };
}

function resolveImageBuffer(rawBase64?: string, rawUrl?: string, rawBinary?: unknown): Buffer {
  if (Buffer.isBuffer(rawBinary)) {
    return rawBinary;
  }
  if (rawBinary instanceof Uint8Array) {
    return Buffer.from(rawBinary);
  }
  if (Array.isArray(rawBinary)) {
    return Buffer.from(rawBinary as number[]);
  }
  if (typeof rawBinary === "string" && rawBinary.trim()) {
    const trimmed = rawBinary.trim();
    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0 && trimmed.length > 20) {
      return Buffer.from(trimmed, "hex");
    }
    return Buffer.from(trimmed.replace(/^data:image\/[a-zA-Z+]+;base64,/, ""), "base64");
  }
  if (rawBase64) {
    return Buffer.from(rawBase64.replace(/^data:image\/[a-zA-Z+]+;base64,/, ""), "base64");
  }
  if (!rawUrl) {
    throw new McpError(-32602, "Either base64_data, binary_data, or image_url must be provided.");
  }
  if (rawUrl.startsWith("data:image/")) {
    const commaIdx = rawUrl.indexOf(",");
    return Buffer.from(rawUrl.slice(commaIdx + 1), "base64");
  }
  if (/^https?:\/\//i.test(rawUrl)) {
    try {
      return execFileSync("curl", ["-sL", "--max-time", "15", rawUrl], {
        maxBuffer: 15 * 1024 * 1024,
      });
    } catch (err) {
      throw new McpError(-32603, `Failed to download image from URL: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  const cleanPath = rawUrl.replace(/^file:\/\//, "");
  let resolved: string | null = null;
  if (fs.existsSync(cleanPath)) {
    resolved = cleanPath;
  } else if (cleanPath.startsWith("/")) {
    const pubPath = path.join(process.cwd(), "public", cleanPath);
    if (fs.existsSync(pubPath)) {
      resolved = pubPath;
    }
  } else {
    const relPub = path.join(process.cwd(), "public", cleanPath);
    const relRoot = path.resolve(process.cwd(), cleanPath);
    if (fs.existsSync(relPub)) {
      resolved = relPub;
    } else if (fs.existsSync(relRoot)) {
      resolved = relRoot;
    }
  }
  if (!resolved || !fs.existsSync(resolved)) {
    throw new McpError(-32004, `Local image file not found: ${rawUrl}`);
  }
  return fs.readFileSync(resolved);
}

function getMcpAuditActor(args?: unknown): AuditActor {
  const a = args && typeof args === "object" ? (args as Record<string, unknown>) : {};
  return {
    actor_type: "mcp",
    actor_id: typeof a.actor_id === "string" && a.actor_id.trim() ? a.actor_id.trim() : "mcp-agent",
    actor_email: "mcp-agent@teafloww.com",
    reason: typeof a.reason === "string" && a.reason.trim() ? a.reason.trim() : "MCP tool execution",
  };
}

const trialListArgs = z.object({
  status: z.enum(["all", "draft", "in_review", "published", "archived"]).default("all"),
  tag: z.string().trim().max(100).optional(),
  search: z.string().trim().max(100).optional(),
  q: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  sort_by: z.enum(["created_at", "updated_at", "title", "price_paise"]).default("updated_at"),
  sort_dir: z.enum(["asc", "desc"]).default("desc"),
});

const trialGetArgs = z.object({
  id: z.string().trim().optional(),
  slug: z.string().trim().optional(),
  idOrSlug: z.string().trim().optional(),
}).refine((data) => Boolean(data.id || data.slug || data.idOrSlug), {
  message: "Either 'id' or 'slug' must be provided.",
});

const trialCreateArgs = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(180),
  slug: z.string().trim().max(120).optional(),
  tagline: z.string().trim().max(250).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  price_paise: z.coerce.number().int().min(0).default(20000),
  compare_at_price_paise: z.coerce.number().int().min(0).nullable().optional(),
  cost_paise: z.coerce.number().int().min(0).nullable().optional(),
  sku: z.string().trim().max(60).optional(),
  inventory_quantity: z.coerce.number().int().min(0).default(0),
  inventory_policy: z.enum(["track", "continue"]).default("track"),
  hero_image_id: z.coerce.number().int().positive().nullable().optional(),
  meta_title: z.string().trim().max(200).nullable().optional(),
  meta_description: z.string().trim().max(500).nullable().optional(),
  components: z.array(z.object({
    id: z.string().optional(),
    slot_index: z.coerce.number().int().min(0).max(3),
    name: z.string().trim().min(2),
    estate: z.string().trim().default(""),
    grade: z.string().trim().default(""),
    flush: z.string().trim().default(""),
    elevation: z.string().trim().nullable().optional(),
    weight_g: z.coerce.number().int().default(50),
    quantity: z.coerce.number().int().default(1),
    tasting_notes: z.array(z.string()).default([]),
    brew_temp_c: z.coerce.number().int().default(95),
    brew_time_sec: z.coerce.number().int().default(240),
    leaf_dose_g: z.coerce.number().default(2.5),
    regular_product_id: z.union([z.string(), z.number()]).nullable().optional(),
    regular_variant_id: z.union([z.string(), z.number()]).nullable().optional(),
    sort_order: z.coerce.number().int().optional(),
  })).optional(),
  actor_id: z.string().optional(),
  reason: z.string().optional(),
});

const trialUpdateArgs = z.object({
  id: z.string().trim().min(1, "Trial id is required"),
  expected_revision: z.coerce.number().int("expected_revision must be an integer"),
  title: z.string().trim().min(3).max(180).optional(),
  slug: z.string().trim().max(120).optional(),
  tagline: z.string().trim().max(250).nullable().optional(),
  description: z.string().trim().max(5000).nullable().optional(),
  price_paise: z.coerce.number().int().min(0).optional(),
  compare_at_price_paise: z.coerce.number().int().min(0).nullable().optional(),
  cost_paise: z.coerce.number().int().min(0).nullable().optional(),
  sku: z.string().trim().max(60).optional(),
  inventory_quantity: z.coerce.number().int().min(0).optional(),
  inventory_policy: z.enum(["track", "continue"]).optional(),
  hero_image_id: z.coerce.number().int().positive().nullable().optional(),
  meta_title: z.string().trim().max(200).nullable().optional(),
  meta_description: z.string().trim().max(500).nullable().optional(),
  actor_id: z.string().optional(),
  reason: z.string().optional(),
});

const componentItemSchema = z.object({
  id: z.string().optional(),
  slot_index: z.coerce.number().int().min(0).max(3),
  name: z.string().trim().min(2, "Component name must be at least 2 characters"),
  estate: z.string().trim().default(""),
  grade: z.string().trim().default(""),
  flush: z.string().trim().default(""),
  elevation: z.string().trim().nullable().optional(),
  weight_g: z.coerce.number().int().default(50),
  quantity: z.coerce.number().int().default(1),
  tasting_notes: z.array(z.string()).default([]),
  brew_temp_c: z.coerce.number().int().default(95),
  brew_time_sec: z.coerce.number().int().default(240),
  leaf_dose_g: z.coerce.number().default(2.5),
  regular_product_id: z.union([z.string(), z.number()]).nullable().optional(),
  regular_variant_id: z.union([z.string(), z.number()]).nullable().optional(),
  sort_order: z.coerce.number().int().optional(),
});

const trialComponentsReplaceArgs = z.object({
  id: z.string().trim().min(1, "Trial id is required"),
  expected_revision: z.coerce.number().int("expected_revision must be an integer"),
  components: z.array(componentItemSchema),
  actor_id: z.string().optional(),
  reason: z.string().optional(),
});

const trialMediaAttachArgs = z.object({
  id: z.string().trim().min(1, "Trial id is required"),
  expected_revision: z.coerce.number().int("expected_revision must be an integer"),
  component_id: z.string().nullable().optional(),
  slot_index: z.coerce.number().int().min(0).max(3).nullable().optional(),
  media_id: z.coerce.number().int().positive().nullable().optional(),
  asset_url: z.string().trim().max(500).optional(),
  url: z.string().trim().max(500).optional(),
  stage: z.string().trim().min(1, "Stage is required"),
  alt_text: z.string().trim().min(2, "Descriptive alt text is required (min 2 chars)").max(250),
  caption: z.string().trim().max(250).nullable().optional(),
  rights_status: z.enum(["pending", "approved", "rejected"]).default("approved"),
  sort_order: z.coerce.number().int().default(0),
  actor_id: z.string().optional(),
  reason: z.string().optional(),
}).transform((data) => {
  let stage = data.stage.toLowerCase();
  if (stage === "wet_leaf" || stage === "infusing") stage = "infused_leaf";
  if (stage === "sensory") stage = "liquor";
  return {
    ...data,
    stage,
    effective_url: (data.asset_url || data.url || "").trim(),
  };
}).refine((data) => data.effective_url.length > 0, {
  message: "asset_url or url is required",
  path: ["asset_url"],
});

const trialValidateArgs = z.object({
  id: z.string().trim().min(1, "Trial id or slug is required"),
});

const trialSubmitReviewArgs = z.object({
  id: z.string().trim().min(1, "Trial id is required"),
  expected_revision: z.coerce.number().int("expected_revision must be an integer"),
  actor_id: z.string().optional(),
  reason: z.string().optional(),
});

const trialPublishArgs = z.object({
  id: z.string().trim().min(1, "Trial id is required"),
  expected_revision: z.coerce.number().int("expected_revision must be an integer"),
  actor_id: z.string().optional(),
  reason: z.string().optional(),
});

const trialUnpublishArgs = z.object({
  id: z.string().trim().min(1, "Trial id is required"),
  expected_revision: z.coerce.number().int("expected_revision must be an integer"),
  actor_id: z.string().optional(),
  reason: z.string().optional(),
});

const trialArchiveArgs = z.object({
  id: z.string().trim().min(1, "Trial id is required"),
  expected_revision: z.coerce.number().int("expected_revision must be an integer"),
  actor_id: z.string().optional(),
  reason: z.string().optional(),
});

const trialHistoryArgs = z.object({
  id: z.string().trim().min(1, "Trial id or slug is required"),
});

export const TOOL_DEFINITIONS: ToolDef[] = [
  {
    name: "subscriptions.list", description: "List private customer replenishment plans and renewal states. Administrative access only.",
    annotations: { title: "List subscriptions", readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    run: args => { parse(z.object({}).strict(), args); return { policy: subscriptionPolicy(), subscriptions: subscriptionList() }; },
  },
  {
    name: "subscriptions.savePolicy", description: "Configure subscription product savings and additional prepaid savings in basis points; standard coupons/payment offers do not stack. Version is required; existing accepted discounts remain unchanged.",
    annotations: { title: "Save subscription policy", readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    inputSchema: { type: "object", properties: { enabled: { type: "boolean" }, renewalsEnabled: { type: "boolean" }, baseBps: { type: "integer", minimum: 0, maximum: 9900 }, prepaidBps: { type: "integer", minimum: 0, maximum: 9900 }, version: { type: "integer", minimum: 1 } }, required: ["enabled","renewalsEnabled","baseBps","prepaidBps","version"], additionalProperties: false },
    run: args => ({ policy: saveSubscriptionPolicy(args) }),
  },
  {
    name: "store.listProducts",
    description: "List catalogue products. Optional text query, category filter, featured flag.",
    annotations: {
      title: "List Products",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", maxLength: 100 },
        category: { type: "string", maxLength: 40 },
        featured: { type: "boolean" },
      },
    },
    run: (args) => ({ products: listProducts(parse(listProductsArgs, args)) }),
  },
  {
    name: "store.getProduct",
    description: "Get one product with variants, technical specifications, and gallery images by slug.",
    annotations: {
      title: "Get Product by Slug",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: { slug: { type: "string", maxLength: 120 } },
    },
    run: (args) => {
      const product = getProductBySlug(parse(getProductArgs, args).slug);
      if (!product) throw new McpError(-32004, "The requested tea is unavailable.");
      const specs = product.specs ?? getProductSpecs(product);
      const images = listProductImages(product.id);
      return { product: { ...product, images }, specs, images };
    },
  },
  {
    name: "store.getProductSpecs",
    description: "Get detailed technical specifications (cupping profile, 6-axis sensory scores, terroir, steeping parameters, packaging, pricing) for a product by slug or numeric ID.",
    annotations: {
      title: "Get Product Specifications",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Product slug identifier" },
        id: { type: "integer", description: "Product numeric ID" },
        slugOrId: { description: "Product slug or numeric ID" },
      },
    },
    run: (args) => {
      const parsed = parse(getProductSpecsArgs, args);
      const identifier = parsed.slug ?? parsed.id ?? parsed.slugOrId;
      if (!identifier) {
        throw new McpError(-32602, "Either slug, id, or slugOrId is required.");
      }
      let product: Product | null = null;
      if (typeof identifier === "number") {
        product = getProduct(identifier);
      } else {
        const num = Number(identifier);
        if (!Number.isNaN(num) && String(num) === String(identifier).trim()) {
          product = getProduct(num);
        }
        if (!product) {
          product = getProductBySlug(String(identifier));
        }
      }
      if (!product) {
        throw new McpError(-32004, `Product '${identifier}' not found.`);
      }
      const specs = product.specs ?? getProductSpecs(product);
      return {
        product_id: product.id,
        slug: product.slug,
        name: product.name,
        category: product.category,
        origin: product.origin,
        estate: product.estate,
        specs,
      };
    },
  },
  {
    name: "store.listCategories",
    description: "List categories (active by default).",
    annotations: {
      title: "List Categories",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: { activeOnly: { type: "boolean" } } },
    run: (args) => {
      const { activeOnly } = parse(activeOnlyArgs, args);
      return { categories: listCategories({ activeOnly: activeOnly ?? true }) };
    },
  },
  {
    name: "store.getCategory",
    description: "Get one category by slug or numeric ID.",
    annotations: {
      title: "Get Category",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string" },
        id: { type: "integer" },
        slugOrId: {},
      },
    },
    run: (args) => {
      const parsed = parse(getCategoryArgs, args);
      const target = parsed.slug ?? parsed.id ?? parsed.slugOrId;
      if (!target) throw new McpError(-32602, "Either slug, id, or slugOrId is required.");
      let category = null;
      if (typeof target === "number") {
        category = getCategory(target);
      } else {
        const num = Number(target);
        if (!Number.isNaN(num) && String(num) === String(target).trim()) {
          category = getCategory(num);
        }
        if (!category) {
          category = getCategoryBySlug(String(target));
        }
      }
      if (!category) throw new McpError(-32004, "The requested category was not found.");
      return { category };
    },
  },
  {
    name: "store.listSliders",
    description: "List hero sliders (active display window by default, optionally filtered by page target or category).",
    annotations: {
      title: "List Storefront Hero Sliders",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        activeOnly: { type: "boolean", description: "Only return currently active sliders (default true)" },
        page_target: { type: "string", enum: ["home", "shop", "all"], description: "Filter by page target ('home', 'shop', or 'all')" },
        category_slug: { type: "string", description: "Filter by category slug" },
      },
    },
    run: (args) => {
      const { activeOnly, page_target, category_slug } = parse(listSlidersArgs, args);
      return {
        sliders: listSliders({
          activeOnly: activeOnly ?? true,
          pageTarget: page_target,
          categorySlug: category_slug,
        }),
      };
    },
  },
  {
    name: "store.validateCoupon",
    description: "Check a coupon code against a subtotal. Returns validity + discount, no mutation.",
    annotations: {
      title: "Validate Coupon",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["code", "subtotalPaise"],
      properties: {
        code: { type: "string", maxLength: 24 },
        subtotalPaise: { type: "integer", minimum: 0 },
      },
    },
    run: (args) => {
      const { code, subtotalPaise } = parse(validateCouponArgs, args);
      return quoteCoupon(code, subtotalPaise);
    },
  },
  {
    name: "admin.upsertProduct",
    description: "Create or update full product details by ID, slug or name: category_id, descriptions, verified ingredients and origin, tasting and brewing specifications, SEO metadata, pricing, pack-size variants and gallery images. Omitted fields and images are preserved on updates. price is in INR; price_paise is in paise. Optional idempotencyKey; replays echo deduped:true.",
    annotations: {
      title: "Upsert Product",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: productUpsertInputSchema,
    run: handleProductUpsert,
  },
  {
    name: "admin.createProduct",
    description: "Create a new tea product. Returns product details, pricing, and full specifications.",
    annotations: {
      title: "Create Product",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: productUpsertInputSchema,
    run: handleProductUpsert,
  },
  {
    name: "admin.updateProduct",
    description: "Update an existing tea product by slug or ID. Supports updating publication status ('published', 'draft', 'archived', or boolean publish/draft), verified ingredients, steeping guide (brew_temp, brew_seconds, leaf_dose_grams, water_ml, steep_count, steep_instructions), sensory ratings (floral, fruity, malty, body, sweetness, earthy 0-5) and tasting_notes, dry/wet leaf and liquor profiles, verified origin/estate/harvest/terroir, pricing, pack-size variants, and inventory stock. Returns updated details and full specifications.",
    annotations: {
      title: "Update Product",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: productUpsertInputSchema,
    run: handleProductUpsert,
  },
  {
    name: "admin.updateProductDetails",
    description: "Update full product details for an existing tea product by slug or numeric ID. Sets and updates publication status ('published', 'draft', 'archived', or boolean publish=true/false), verified ingredient lists, product-specific steeping guide (brew_temp, brew_seconds, leaf_dose_grams, water_ml, steep_count, steep_instructions, or nested steeping object), sensory cupping scores (floral, fruity, malty, body, sweetness, earthy 0-5) and tasting_notes / aroma_tags, dry/wet leaf and liquor profiles, verified terroir details (origin, verified_origin, estate, flush, harvest_date, elevation, lot_number, cultivar, estate_story), pack-size variants, and inventory stock. Returns updated product details and full specifications.",
    annotations: {
      title: "Update Full Product Details",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: productUpsertInputSchema,
    run: handleProductUpsert,
  },
  {
    name: "admin.deleteProduct",
    description: "Delete a product by numeric ID or slug. Cascades variants and images. If referenced by historical orders, safely archives the product and zeroes stock to protect order records.",
    annotations: {
      title: "Delete Product",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Product numeric ID" },
        slug: { type: "string", description: "Product slug identifier" },
        idOrSlug: { description: "Product numeric ID or slug" },
        confirmed: { type: "boolean", description: "Confirmation flag" },
        archive: { type: "boolean", description: "Archive flag (soft delete)" },
        archive_if_referenced: { type: "boolean", description: "Auto-archive if product has historical orders" },
      },
    },
    run: (args) => {
      const { id, slug, idOrSlug, confirm, confirmed, archive, archive_if_referenced } = parse(deleteProductArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Deletion was not confirmed.");
      }
      const target = id ?? slug ?? idOrSlug;
      if (!target) throw new McpError(-32602, "Either id or slug is required.");

      const db = getDb();
      let prodId: number | undefined;
      if (typeof target === "number") {
        prodId = target;
      } else {
        const num = Number(target);
        if (!Number.isNaN(num) && String(num) === String(target).trim()) {
          prodId = num;
        } else {
          const p = getProductBySlug(String(target));
          if (p) prodId = p.id;
        }
      }

      if (!prodId) throw new McpError(-32004, "The requested product was not found.");

      if (archive === true) {
        const archived = archiveProduct(prodId);
        if (!archived) throw new McpError(-32004, "The requested product was not found.");
        return { deleted: true, archived: true, message: "Product archived successfully and removed from active storefront catalog." };
      }

      let orderCount = 0;
      try {
        const check = db.prepare(`
          SELECT COUNT(*) AS count
          FROM order_items oi
          JOIN variants v ON oi.variant_id = v.id
          WHERE v.product_id = ?
        `).get(prodId) as { count: number } | undefined;
        orderCount = check?.count ?? 0;
      } catch {
        orderCount = 0;
      }

      if (orderCount > 0) {
        if (archive_if_referenced === false) {
          throw new McpError(-32009, `Product cannot be hard deleted because it is referenced by ${orderCount} order item(s). Use archive=true to soft delete.`);
        }
        archiveProduct(prodId);
        return {
          deleted: true,
          archived: true,
          preserved_orders: true,
          order_count: orderCount,
          message: `Product is referenced by ${orderCount} historical order item(s). It has been archived and removed from storefront to preserve order records.`,
        };
      }

      const deleted = deleteProduct(prodId, { archiveIfReferenced: false });
      if (!deleted) throw new McpError(-32004, "The requested product was not found.");
      return { deleted: true, archived: false };
    },
  },
  {
    name: "admin.setProductStatus",
    description: "Update product publication status ('published', 'draft', 'archived') by numeric ID or slug. Supports 'status' string or boolean 'publish'/'draft'. Returns updated product details.",
    annotations: {
      title: "Set Product Status",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Product numeric ID" },
        slug: { type: "string", description: "Product slug identifier" },
        idOrSlug: { description: "Product numeric ID or slug" },
        status: { type: "string", enum: ["published", "draft", "archived"], description: "Target publication status" },
        publish: { type: "boolean", description: "True to mark product published" },
        published: { type: "boolean", description: "True to mark product published" },
        draft: { type: "boolean", description: "True to mark draft" },
        is_draft: { description: "Draft flag (1/true for draft, 0/false for published)" },
        idempotencyKey: uuidProp,
      },
    },
    run: handleProductUpsert,
  },
  {
    name: "admin.publishProduct",
    description: "Publish a tea product by numeric ID or slug (sets status='published' and is_draft=0). Returns updated product details.",
    annotations: {
      title: "Publish Product",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Product numeric ID" },
        slug: { type: "string", description: "Product slug identifier" },
        idOrSlug: { description: "Product numeric ID or slug" },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => handleProductUpsert({ ...(typeof args === "object" && args !== null ? args : {}), status: "published" }),
  },
  {
    name: "admin.draftProduct",
    description: "Mark a tea product as draft by numeric ID or slug (sets status='draft' and is_draft=1). Returns updated product details.",
    annotations: {
      title: "Draft Product",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Product numeric ID" },
        slug: { type: "string", description: "Product slug identifier" },
        idOrSlug: { description: "Product numeric ID or slug" },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => handleProductUpsert({ ...(typeof args === "object" && args !== null ? args : {}), status: "draft" }),
  },
  {
    name: "admin.updateSteepingGuide",
    description: "Update steeping and brewing guide specifications for a product by ID or slug: brew_temp (°C, 50-100), brew_seconds (30-600), leaf_dose_grams (0.5-20), water_ml (50-2000), steep_count (1-10), steep_instructions. Also accepts nested 'steeping' object. Preserves all other product fields.",
    annotations: {
      title: "Update Steeping Guide",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Product numeric ID" },
        slug: { type: "string", description: "Product slug identifier" },
        idOrSlug: { description: "Product numeric ID or slug" },
        brew_temp: { type: "integer", minimum: 50, maximum: 100, description: "Brew water temperature in °C" },
        brew_seconds: { type: "integer", minimum: 30, maximum: 600, description: "Steeping duration in seconds" },
        leaf_dose_grams: { type: "number", minimum: 0.5, maximum: 20, description: "Recommended leaf dose in grams" },
        water_ml: { type: "integer", minimum: 50, maximum: 2000, description: "Water volume in milliliters" },
        steep_count: { type: "integer", minimum: 1, maximum: 10, description: "Recommended number of infusions" },
        steep_instructions: { type: "string", maxLength: 1000, description: "Detailed brewing instructions" },
        instructions: { type: "string", description: "Alias for steep_instructions" },
        steeping: { type: "object", description: "Nested steeping parameters object" },
        idempotencyKey: uuidProp,
      },
    },
    run: handleProductUpsert,
  },
  {
    name: "admin.updateIngredients",
    description: "Update verified ingredient declarations for a tea product by numeric ID or slug. Accepts comma-separated string, array of strings, or array of ingredient objects with name/percentage.",
    annotations: {
      title: "Update Product Ingredients",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Product numeric ID" },
        slug: { type: "string", description: "Product slug identifier" },
        idOrSlug: { description: "Product numeric ID or slug" },
        ingredients: { description: "Verified ingredients as a string, list of strings, or array of ingredient objects" },
        ingredients_public: { type: "string", description: "Public verified ingredient declaration" },
        idempotencyKey: uuidProp,
      },
    },
    run: handleProductUpsert,
  },
  {
    name: "admin.updateSensoryProfile",
    description: "Update sensory tasting notes, cupping scores (floral, fruity, malty, body, sweetness, earthy on 0-5 scale), and aroma tags for a product by ID or slug. Accepts flat fields or nested 'cupping' object.",
    annotations: {
      title: "Update Sensory Profile",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Product numeric ID" },
        slug: { type: "string", description: "Product slug identifier" },
        idOrSlug: { description: "Product numeric ID or slug" },
        tasting_notes: { type: "string", maxLength: 500, description: "Sensory tasting notes summary" },
        floral: { type: "integer", minimum: 0, maximum: 5 },
        fruity: { type: "integer", minimum: 0, maximum: 5 },
        malty: { type: "integer", minimum: 0, maximum: 5 },
        body: { type: "integer", minimum: 0, maximum: 5 },
        sweetness: { type: "integer", minimum: 0, maximum: 5 },
        earthy: { type: "integer", minimum: 0, maximum: 5 },
        aroma_tags: { type: "array", items: { type: "string" } },
        cupping: { type: "object", description: "Nested cupping object with flavorScores and aromaTags" },
        idempotencyKey: uuidProp,
      },
    },
    run: handleProductUpsert,
  },
  {
    name: "admin.updateLeafProfile",
    description: "Update dry leaf appearance/grade/aroma, liquor hue/clarity/body, and wet leaf aroma/oxidation for a product by ID or slug.",
    annotations: {
      title: "Update Leaf and Liquor Profile",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Product numeric ID" },
        slug: { type: "string", description: "Product slug identifier" },
        idOrSlug: { description: "Product numeric ID or slug" },
        dry_leaf_appearance: { type: "string", maxLength: 300 },
        dry_leaf_grade: { type: "string", maxLength: 100 },
        dry_leaf_aroma: { type: "string", maxLength: 300 },
        liquor_hue_hex: { type: "string" },
        liquor_hue_name: { type: "string", maxLength: 100 },
        liquor_clarity: { type: "string", maxLength: 100 },
        liquor_body: { type: "string", maxLength: 100 },
        wet_leaf_aroma: { type: "string", maxLength: 300 },
        wet_leaf_oxidation: { type: "string", maxLength: 100 },
        dry_leaf: { type: "object" },
        liquor: { type: "object" },
        wet_leaf: { type: "object" },
        idempotencyKey: uuidProp,
      },
    },
    run: handleProductUpsert,
  },
  {
    name: "admin.updateProvenance",
    description: "Update verified origin, estate, harvest season/flush, harvest date, elevation, lot number, cultivar, and estate story for a product by ID or slug.",
    annotations: {
      title: "Update Origin and Provenance",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Product numeric ID" },
        slug: { type: "string", description: "Product slug identifier" },
        idOrSlug: { description: "Product numeric ID or slug" },
        origin: { type: "string", maxLength: 120 },
        verified_origin: { type: "string", maxLength: 200 },
        estate: { type: "string", maxLength: 120 },
        flush: { type: "string", maxLength: 60 },
        harvest_date: { type: "string", maxLength: 80 },
        elevation_feet: { type: "integer", minimum: 0, maximum: 30000 },
        elevation_display: { type: "string", maxLength: 100 },
        lot_number: { type: "string", maxLength: 60 },
        cultivar: { type: "string", maxLength: 100 },
        estate_story: { type: "string", maxLength: 3000 },
        terroir: { type: "object" },
        provenance: { type: "object" },
        idempotencyKey: uuidProp,
      },
    },
    run: handleProductUpsert,
  },
  {
    name: "admin.listVariants",
    description: "List all variants across the catalogue or for a specific product ID.",
    annotations: {
      title: "List Variants",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        product_id: { type: "integer", description: "Optional product ID to filter variants" },
      },
    },
    run: (args) => {
      const { product_id } = parse(listVariantsArgs, args);
      return { variants: listAllVariants(product_id) };
    },
  },
  {
    name: "admin.upsertVariant",
    description: "Create or update a variant by SKU: price, Original MRP discount (compare_at_price_paise/mrp, null clears), stock, grams, packaging, servings. Omitted MRP preserves the stored value. Optional idempotencyKey.",
    annotations: {
      title: "Upsert Product Variant",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: variantUpsertInputSchema,
    run: handleVariantUpsert,
  },
  {
    name: "admin.createVariant",
    description: "Create a product variant by SKU with pack size, pricing in paise, Original MRP discount, and inventory stock.",
    annotations: {
      title: "Create Product Variant",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: variantUpsertInputSchema,
    run: handleVariantUpsert,
  },
  {
    name: "admin.updateVariant",
    description: "Update an existing product variant by SKU (price in paise, Original MRP discount, stock, grams, packaging). Omitted MRP preserves the stored value; null clears it.",
    annotations: {
      title: "Update Product Variant",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: variantUpsertInputSchema,
    run: handleVariantUpsert,
  },
  {
    name: "admin.deleteVariant",
    description: "Delete a variant by numeric ID or SKU.",
    annotations: {
      title: "Delete Variant",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer", description: "Variant ID" },
        sku: { type: "string", description: "Variant SKU" },
        confirmed: { type: "boolean", description: "Confirmation flag" },
      },
    },
    run: (args) => {
      const { id, sku, confirm, confirmed } = parse(deleteVariantArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Deletion was not confirmed.");
      }
      let deleted = false;
      if (id !== undefined) {
        deleted = deleteVariant(id);
      } else if (sku) {
        deleted = deleteVariantBySku(sku);
      } else {
        throw new McpError(-32602, "Either id or sku is required.");
      }
      if (!deleted) throw new McpError(-32004, "The requested variant was not found.");
      return { deleted: true };
    },
  },
  {
    name: "inventory.updateStock",
    description: "Set inventory to an exact quantity by product (id/slug) or SKU. Product mode updates all variants (creating one default 100g variant when none exist). Optional idempotencyKey.",
    annotations: {
      title: "Update Inventory Stock",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["quantity"],
      properties: {
        product: { description: "Product numeric ID or slug" },
        product_id: { type: "integer", description: "Product numeric ID (alias for product)" },
        product_slug: { type: "string", description: "Product slug (alias for product)" },
        slug: { type: "string", description: "Product slug (alias for product)" },
        idOrSlug: { description: "Product numeric ID or slug (alias for product)" },
        sku: { type: "string", description: "Variant SKU (updates that single variant)" },
        variantId: { type: "integer", description: "Variant numeric ID (updates that single variant)" },
        variant_id: { type: "integer", description: "Variant numeric ID (alias for variantId)" },
        quantity: { type: "integer", description: "Exact stock quantity to set (0-999999)" },
        stock: { type: "integer", description: "Exact stock quantity (alias for quantity)" },
        inventory: { type: "integer", description: "Exact inventory quantity (alias for quantity)" },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => {
      const normalized = normalizeInventoryInput(args);
      const parsed = parse(updateInventoryArgs, normalized);
      try {
        const { body, deduped } = updateInventoryStock(parsed);
        return { ...body, deduped };
      } catch (error) {
        serviceError(error);
      }
    },
  },
  {
    name: "admin.updateInventory",
    description: "Update inventory stock for a product (by ID or slug across all variants) or for a specific SKU. Direct admin tool alias for inventory.updateStock.",
    annotations: {
      title: "Update Inventory Stock",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["quantity"],
      properties: {
        product: { description: "Product numeric ID or slug" },
        product_id: { type: "integer", description: "Product numeric ID (alias for product)" },
        product_slug: { type: "string", description: "Product slug (alias for product)" },
        slug: { type: "string", description: "Product slug (alias for product)" },
        idOrSlug: { description: "Product numeric ID or slug (alias for product)" },
        sku: { type: "string", description: "Variant SKU (updates that single variant)" },
        variantId: { type: "integer", description: "Variant numeric ID (updates that single variant)" },
        variant_id: { type: "integer", description: "Variant numeric ID (alias for variantId)" },
        quantity: { type: "integer", description: "Exact stock quantity to set (0-999999)" },
        stock: { type: "integer", description: "Exact stock quantity (alias for quantity)" },
        inventory: { type: "integer", description: "Exact inventory quantity (alias for quantity)" },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => {
      const normalized = normalizeInventoryInput(args);
      const parsed = parse(updateInventoryArgs, normalized);
      try {
        const { body, deduped } = updateInventoryStock(parsed);
        return { ...body, deduped };
      } catch (error) {
        serviceError(error);
      }
    },
  },
  {
    name: "admin.upsertCategory",
    description: "Create or update a category by slug. Supports cover_image_url and sort_order. Returns recommended image dimensions. Optional idempotencyKey.",
    annotations: {
      title: "Upsert Category",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: categoryUpsertInputSchema,
    run: handleCategoryUpsert,
  },
  {
    name: "admin.createCategory",
    description: "Create a new tea category by slug. Returns recommended image dimensions.",
    annotations: {
      title: "Create Category",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: categoryUpsertInputSchema,
    run: handleCategoryUpsert,
  },
  {
    name: "admin.updateCategory",
    description: "Update category by slug or ID (display name, cover image, sort order, active status).",
    annotations: {
      title: "Update Category",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: categoryUpsertInputSchema,
    run: handleCategoryUpsert,
  },
  {
    name: "admin.deleteCategory",
    description: "Delete category by numeric ID or slug. Protected if category contains products.",
    annotations: {
      title: "Delete Category",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer" },
        slug: { type: "string" },
        confirmed: { type: "boolean" },
      },
    },
    run: (args) => {
      const { id, slug, confirm, confirmed } = parse(deleteCategoryArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Deletion was not confirmed.");
      }
      let deleted = false;
      if (id !== undefined) {
        deleted = deleteCategory(id);
      } else if (slug) {
        deleted = deleteCategoryBySlug(slug);
      } else {
        throw new McpError(-32602, "Either id or slug is required.");
      }
      if (!deleted) throw new McpError(-32004, "The requested category was not found.");
      return { deleted: true };
    },
  },
  {
    name: "admin.listProductImages",
    description: "List all gallery images for a product by product ID.",
    annotations: {
      title: "List Product Images",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["product_id"],
      properties: {
        product_id: { type: "integer" },
      },
    },
    run: (args) => {
      const { product_id } = parse(listProductImagesArgs, args);
      return { images: listProductImages(product_id) };
    },
  },
  {
    name: "admin.upsertProductImage",
    description: "Add a gallery image (alt_text required). Returns required 1:1 square dimensions (recommended 1200x1200px, min 800x800px). Optional idempotencyKey.",
    annotations: {
      title: "Upsert Product Image",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: productImageUpsertInputSchema,
    run: handleProductImageUpsert,
  },
  {
    name: "admin.createProductImage",
    description: "Add a gallery image to a product (alt_text required). Returns required 1:1 square dimensions.",
    annotations: {
      title: "Create Product Image",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: productImageUpsertInputSchema,
    run: handleProductImageUpsert,
  },
  {
    name: "admin.deleteProductImage",
    description: "Delete a product gallery image by numeric ID.",
    annotations: {
      title: "Delete Product Image",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "integer" },
        confirmed: { type: "boolean" },
      },
    },
    run: (args) => {
      const { id, confirm, confirmed } = parse(deleteProductImageArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Deletion was not confirmed.");
      }
      const deleted = deleteProductImage(id);
      if (!deleted) throw new McpError(-32004, "The requested product image was not found.");
      return { deleted: true };
    },
  },
  {
    name: "admin.upsertSlider",
    description: "Create a homepage slider. Returns recommended panoramic banner dimensions (1920x800px 2.4:1 / 16:9). Optional idempotencyKey.",
    annotations: {
      title: "Upsert Hero Slider",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: sliderUpsertInputSchema,
    run: handleSliderUpsert,
  },
  {
    name: "admin.createSlider",
    description: "Create a homepage hero slider. Returns recommended panoramic banner dimensions.",
    annotations: {
      title: "Create Hero Slider",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: sliderUpsertInputSchema,
    run: handleSliderUpsert,
  },
  {
    name: "admin.updateSlider",
    description: "Update an existing homepage hero slider by numeric ID. Supports updating background panoramic image (image_url / bg_image_url), foreground card image (fg_image_url / card_image_url), and Featured Harvest Card text content (card_tag, card_title, card_subtitle, card_tasting_notes, card_quote, card_badge, card_cta_label, card_cta_href).",
    annotations: {
      title: "Update Hero Slider",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: sliderUpdateInputSchema,
    run: handleSliderUpdate,
  },
  {
    name: "admin.deleteSlider",
    description: "Delete a homepage hero slider by numeric ID.",
    annotations: {
      title: "Delete Slider",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "integer" },
        confirmed: { type: "boolean" },
      },
    },
    run: (args) => {
      const { id, confirm, confirmed } = parse(deleteSliderArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Deletion was not confirmed.");
      }
      const deleted = deleteSlider(id);
      if (!deleted) throw new McpError(-32004, "The requested slider was not found.");
      return { deleted: true };
    },
  },
  {
    name: "admin.listCoupons",
    description: "List all promotional coupons with discount structures and validity status.",
    annotations: {
      title: "List Coupons",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        activeOnly: { type: "boolean" },
      },
    },
    run: (args) => {
      const { activeOnly } = parse(activeOnlyArgs, args);
      const coupons = listCoupons();
      return { coupons: activeOnly ? coupons.filter((c) => c.is_active === 1) : coupons };
    },
  },
  {
    name: "admin.getCoupon",
    description: "Get full details of a promotional coupon by code.",
    annotations: {
      title: "Get Coupon Details",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["code"],
      properties: {
        code: { type: "string", maxLength: 24 },
      },
    },
    run: (args) => {
      const { code } = parse(getCouponArgs, args);
      const coupon = getCoupon(code);
      if (!coupon) throw new McpError(-32004, "The requested coupon was not found.");
      return { coupon };
    },
  },
  {
    name: "admin.upsertCoupon",
    description: "Create or update a coupon by code (percent 1–50). Optional idempotencyKey.",
    annotations: {
      title: "Upsert Promotional Coupon",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: couponUpsertInputSchema,
    run: handleCouponUpsert,
  },
  {
    name: "admin.createCoupon",
    description: "Create a promotional discount coupon by code.",
    annotations: {
      title: "Create Promotional Coupon",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: couponUpsertInputSchema,
    run: handleCouponUpsert,
  },
  {
    name: "admin.updateCoupon",
    description: "Update a promotional discount coupon by code.",
    annotations: {
      title: "Update Promotional Coupon",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: couponUpsertInputSchema,
    run: handleCouponUpsert,
  },
  {
    name: "admin.deleteCoupon",
    description: "Delete a promotional coupon by code.",
    annotations: {
      title: "Delete Coupon",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["code"],
      properties: {
        code: { type: "string", maxLength: 24 },
        confirmed: { type: "boolean" },
      },
    },
    run: (args) => {
      const { code, confirm, confirmed } = parse(deleteCouponArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Deletion was not confirmed.");
      }
      const deleted = deleteCoupon(code);
      if (!deleted) throw new McpError(-32004, "The requested coupon was not found.");
      return { deleted: true };
    },
  },
  {
    name: "admin.deleteEntity",
    description: "Delete one entity by id (coupon id is code; blog id is slug or number; user id is number; site_placement is section_key). In-use records are rejected.",
    annotations: {
      title: "Delete Catalog Entity",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["entity", "id"],
      properties: {
        entity: { type: "string", enum: ["product", "variant", "category", "product_image", "slider", "coupon", "blog", "user", "site_placement", "page", "content_block"] },
        id: { description: "Unique ID (numeric ID, slug for blog/category/product/page, sku for variant, content block key, or coupon code)" },
        confirmed: { type: "boolean", description: "Confirmation flag to verify intentional deletion of live data." },
      },
    },
    run: (args) => {
      const { entity, id, confirm, confirmed } = parse(deleteEntityArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Deletion was not confirmed.");
      }
      let deleted: boolean;
      if (entity === "page") {
        deleted = deletePage(id);
      } else if (entity === "content_block") {
        deleted = deleteContentBlock(String(id));
      } else if (entity === "coupon") {
        if (typeof id !== "string" || !id) throw new McpError(-32602, "Please check the tool arguments and try again.");
        deleted = deleteCoupon(id);
      } else if (entity === "blog") {
        if (!id || (typeof id !== "string" && typeof id !== "number")) {
          throw new McpError(-32602, "Please check the tool arguments and try again.");
        }
        deleted = deleteBlogPost(id);
      } else if (entity === "user") {
        const numId = typeof id === "number" ? id : parseInt(String(id), 10);
        if (!Number.isFinite(numId) || numId <= 0) throw new McpError(-32602, "Please check the tool arguments and try again.");
        deleted = deleteAdminUser(numId);
      } else if (entity === "site_placement") {
        if (typeof id !== "string" || !id) throw new McpError(-32602, "Please check the tool arguments and try again.");
        deleted = deleteSitePlacement(id);
      } else if (entity === "product") {
        if (typeof id === "number") {
          deleted = deleteProduct(id);
        } else {
          const num = Number(id);
          if (!Number.isNaN(num) && String(num) === String(id).trim()) {
            deleted = deleteProduct(num);
          } else {
            deleted = deleteProductBySlug(String(id));
          }
        }
      } else if (entity === "variant") {
        if (typeof id === "number") {
          deleted = deleteVariant(id);
        } else {
          const num = Number(id);
          if (!Number.isNaN(num) && String(num) === String(id).trim()) {
            deleted = deleteVariant(num);
          } else {
            deleted = deleteVariantBySku(String(id));
          }
        }
      } else if (entity === "category") {
        if (typeof id === "number") {
          deleted = deleteCategory(id);
        } else {
          const num = Number(id);
          if (!Number.isNaN(num) && String(num) === String(id).trim()) {
            deleted = deleteCategory(num);
          } else {
            deleted = deleteCategoryBySlug(String(id));
          }
        }
      } else {
        const numId = typeof id === "number" ? id : Number(id);
        if (Number.isNaN(numId) || numId <= 0) throw new McpError(-32602, "Please check the tool arguments and try again.");
        deleted = entity === "product_image" ? deleteProductImage(numId) : deleteSlider(numId);
      }
      if (!deleted) throw new McpError(-32004, "The requested record was not found.");
      return { deleted: true };
    },
  },
  {
    name: "media.listMedia",
    description: "List uploaded media assets with search, MIME filtering, and cursor pagination.",
    annotations: {
      title: "List Media Assets",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string", maxLength: 100 },
        mime_type: { type: "string", enum: ["image/jpeg", "image/png", "image/webp", "image/avif"] },
        cursor: { type: "integer", minimum: 0 },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    },
    run: (args) => listMedia(parse(listMediaArgs, args)),
  },
  {
    name: "media.getImageRequirements",
    description: "Query required and recommended image dimensions, aspect ratios, min/max bounds, and format rules for all storefront placements (products, categories, sliders, site placements, and blogs).",
    annotations: {
      title: "Get Image Dimension Requirements",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        entity_type: {
          type: "string",
          enum: ["product", "category", "slider", "site_placement", "blog"],
          description: "Optional filter for a specific entity type.",
        },
        section_key: {
          type: "string",
          description: "Optional site placement section key (e.g. home_hero, home_story, home_craft, home_newsletter, home_values).",
        },
      },
    },
    run: (args) => getImageRequirements(parse(getImageRequirementsArgs, args)),
  },
  {
    name: "media.uploadMedia",
    description: "Upload a media asset using base64 encoded data, remote URL, or local file path with validation and deduplication. Automatically detects width and height dimensions and returns required dimensions for all storefront placement targets.",
    annotations: {
      title: "Upload Media Asset",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["filename"],
      properties: {
        filename: { type: "string" },
        base64_data: { type: "string" },
        binary_data: { description: "Raw binary Buffer, Uint8Array, byte array number[], or hex string." },
        image_url: { type: "string", description: "Remote HTTP(S) URL, data URL, or local path to load image from." },
        url: { type: "string", description: "Alias for image_url." },
        alt_text: { type: "string" },
        caption: { type: "string" },
        sort_order: { type: "integer" },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => {
      const input = parse(uploadMediaArgs, args);
      const execute = () => {
        const rawUrl = input.image_url ?? input.imageUrl ?? input.url ?? input.source_url;
        const rawBase64 = input.base64_data ?? input.base64Data;
        const rawBinary = (input as Record<string, unknown>).binary_data ?? (input as Record<string, unknown>).binaryData;
        const buffer = resolveImageBuffer(rawBase64, rawUrl, rawBinary);

        const val = validateImageUpload(buffer, { originalFilename: input.filename });
        const dims = detectImageDimensions(buffer);
        const finalFilename = generateCollisionResistantFilename(input.filename, val.extension);
        const filePath = path.join(getUploadsDir(), finalFilename);
        fs.writeFileSync(filePath, buffer);
        const db = getDb();
        const info = db
          .prepare(
            "INSERT INTO media_uploads (filename, original_name, url, alt_text, caption, mime_type, file_size, width, height, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
          )
          .run(
            finalFilename,
            input.filename,
            `/uploads/${finalFilename}`,
            input.alt_text ?? input.altText ?? "",
            input.caption ?? "",
            val.mimeType,
            buffer.length,
            dims?.width ?? null,
            dims?.height ?? null,
            input.sort_order ?? input.sortOrder ?? 0
          );
        return getMediaById(Number(info.lastInsertRowid));
      };

      let asset: ReturnType<typeof getMediaById>;
      let deduped = false;
      if (!input.idempotencyKey) {
        asset = execute();
      } else {
        const res = idempotent("media_upload", input.idempotencyKey, execute);
        asset = res.body as ReturnType<typeof getMediaById>;
        deduped = res.deduped;
      }

      const w = asset?.width ?? null;
      const h = asset?.height ?? null;

      return {
        success: true,
        asset,
        dimensions: {
          width: w,
          height: h,
          aspect_ratio: w && h ? `${(w / h).toFixed(2)}:1` : null,
        },
        required_dimensions: {
          product: { recommended: "1200x1200px (1:1 Square)", min: "800x800px" },
          category: { recommended: "1200x800px (3:2) / 800x600px (4:3) / 800x800px (1:1)", min: "400x400px" },
          slider: { recommended: "1920x800px (2.4:1 / 16:9 Banner)", min: "1280x600px" },
          page: { recommended: "1920x1080px (16:9)", min: "800x450px" },
          site_placement_hero: { recommended: "1920x800px (2.4:1 / 16:9)", min: "1440x600px" },
          site_placement_story: { recommended: "1200x800px (3:2 Landscape)", min: "600x400px" },
          blog: { recommended: "1200x675px (16:9 Landscape) / 1200x630px", min: "800x450px" },
        },
        compatible_targets: getCompatibleSlots(w, h),
        deduped,
      };
    },
  },
  {
    name: "media.replaceImage",
    description: "Replace the image file of an existing media upload asset (by ID) with new base64 data, URL, or local path. Preserves the asset ID and updates all references across the site.",
    annotations: {
      title: "Replace Image File",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["media_id"],
      properties: {
        media_id: { type: "integer", description: "ID of media asset to replace." },
        base64_data: { type: "string" },
        image_url: { type: "string" },
        url: { type: "string" },
        alt_text: { type: "string" },
        caption: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(replaceImageArgs, args);
      const targetId = parsed.media_id || parsed.id;
      if (!targetId) throw new McpError(-32602, "media_id is required.");
      const current = getMediaById(targetId);
      if (!current) throw new McpError(-32004, "Media asset not found.");

      const rawUrl = parsed.image_url ?? parsed.imageUrl ?? parsed.url;
      const rawBase64 = parsed.base64_data ?? parsed.base64Data;
      const rawBinary = (parsed as Record<string, unknown>).binary_data ?? (parsed as Record<string, unknown>).binaryData;
      const buffer = resolveImageBuffer(rawBase64, rawUrl, rawBinary);

      const val = validateImageUpload(buffer, { originalFilename: parsed.filename || current.original_name });
      const dims = detectImageDimensions(buffer);
      const filePath = path.join(getUploadsDir(), current.filename);
      fs.writeFileSync(filePath, buffer);

      const db = getDb();
      db.prepare(`
        UPDATE media_uploads SET
          file_size = ?,
          width = ?,
          height = ?,
          mime_type = ?,
          alt_text = CASE WHEN ? != '' THEN ? ELSE alt_text END,
          caption = CASE WHEN ? != '' THEN ? ELSE caption END,
          updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(
        buffer.length,
        dims?.width ?? null,
        dims?.height ?? null,
        val.mimeType,
        parsed.alt_text ?? "",
        parsed.alt_text ?? "",
        parsed.caption ?? "",
        parsed.caption ?? "",
        targetId
      );

      return {
        success: true,
        asset: getMediaById(targetId),
        dimensions: { width: dims?.width ?? null, height: dims?.height ?? null },
      };
    },
  },
  {
    name: "media.updateMetadata",
    description: "Update alt text, caption, or sort order of a media asset.",
    annotations: {
      title: "Update Media Metadata",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "integer" },
        alt_text: { type: "string" },
        caption: { type: "string" },
        sort_order: { type: "integer" },
      },
    },
    run: (args) => {
      const { id, ...data } = parse(updateMetadataArgs, args);
      return updateMediaMetadata(id, data);
    },
  },
  {
    name: "media.associateMedia",
    description: "Associate a media asset with a product, category, slider, blog post, site placement, or content page. Returns target entity required dimensions and resolution compatibility.",
    annotations: {
      title: "Associate Media Asset",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["media_id", "entity_type", "entity_id"],
      properties: {
        media_id: { type: "integer" },
        entity_type: { type: "string", enum: ["product", "category", "slider", "site_placement", "blog", "page"] },
        entity_id: {},
        slot: { type: "string", enum: ["bg", "fg", "hero", "cover"], description: "For sliders: 'bg' or 'fg'. For pages: 'hero'. Defaults to 'bg'." },
        target: { type: "string", enum: ["bg", "fg", "hero", "cover"], description: "Alias for slot" },
        is_primary: { type: "boolean" },
      },
    },
    run: (args) => {
      const { media_id, entity_type, entity_id, slot, target, is_primary } = parse(associateMediaArgs, args);
      const media = getMediaById(media_id);
      if (!media) throw new McpError(-32004, "Media asset not found.");
      const db = getDb();
      const sliderSlot = (slot || target || "bg") as "bg" | "fg";
      const requiredSpec = getRequiredDimensionsForEntity(
        entity_type,
        entity_type === "slider" && sliderSlot === "fg" ? "fg" : entity_id
      );
      const matchResult = checkDimensionMatch(requiredSpec, media.width, media.height);

      let extra: Record<string, unknown> = { associated: true };
      if (entity_type === "product") {
        const prodId = typeof entity_id === "number" ? entity_id : Number(entity_id);
        if (Number.isNaN(prodId)) throw new McpError(-32602, "Invalid product ID.");
        const info = db
          .prepare(
            "INSERT INTO product_images (product_id, url, alt_text, sort_order, is_primary, media_id) VALUES (?, ?, ?, 0, ?, ?)"
          )
          .run(prodId, media.url, media.alt_text, is_primary ? 1 : 0, media.id);
        extra = { image_id: Number(info.lastInsertRowid), associated: true };
      } else if (entity_type === "category") {
        const catId = typeof entity_id === "number" ? entity_id : null;
        if (catId) {
          db.prepare("UPDATE categories SET media_id = ?, cover_image_url = ? WHERE id = ?").run(media.id, media.url, catId);
        } else {
          db.prepare("UPDATE categories SET media_id = ?, cover_image_url = ? WHERE slug = ?").run(media.id, media.url, String(entity_id));
        }
      } else if (entity_type === "slider") {
        const sliderId = typeof entity_id === "number" ? entity_id : Number(entity_id);
        if (sliderSlot === "fg") {
          db.prepare("UPDATE sliders SET fg_media_id = ?, fg_image_url = ? WHERE id = ?").run(media.id, media.url, sliderId);
          extra = { slot: "fg", associated: true };
        } else {
          db.prepare("UPDATE sliders SET media_id = ?, image_url = ? WHERE id = ?").run(media.id, media.url, sliderId);
          extra = { slot: "bg", associated: true };
        }
      } else if (entity_type === "site_placement") {
        upsertSitePlacement({ section_key: String(entity_id), media_id: media.id, image_url: media.url, alt_text: media.alt_text });
      } else if (entity_type === "blog") {
        const blogId = typeof entity_id === "number" ? entity_id : null;
        if (blogId) {
          db.prepare("UPDATE blog_posts SET cover_media_id = ?, cover_image_url = ? WHERE id = ?").run(media.id, media.url, blogId);
        } else {
          db.prepare("UPDATE blog_posts SET cover_media_id = ?, cover_image_url = ? WHERE slug = ?").run(media.id, media.url, String(entity_id));
        }
      } else if (entity_type === "page") {
        const pageSlug = String(entity_id).trim().toLowerCase();
        db.prepare("UPDATE site_pages SET hero_media_id = ?, hero_image_url = ?, updated_at = CURRENT_TIMESTAMP WHERE slug = ?").run(media.id, media.url, pageSlug);
        extra = { page_slug: pageSlug, associated: true };
      }

      return {
        success: true,
        entity_type,
        entity_id,
        ...extra,
        required_dimensions: {
          recommended_width: requiredSpec.recommended_width,
          recommended_height: requiredSpec.recommended_height,
          aspect_ratio: requiredSpec.aspect_ratio,
          min_width: requiredSpec.min_width,
          min_height: requiredSpec.min_height,
          description: requiredSpec.description,
        },
        asset_dimensions: {
          width: media.width,
          height: media.height,
        },
        dimension_match: matchResult,
      };
    },
  },
  {
    name: "media.deleteMedia",
    description: "Safely delete an unreferenced media asset by ID. Fails with -32009 if referenced.",
    annotations: {
      title: "Delete Media Asset",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "integer" },
        confirmed: { type: "boolean", description: "Confirmation flag to verify intentional deletion of media asset." },
      },
    },
    run: (args) => {
      const { id, confirm, confirmed } = parse(deleteMediaArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Deletion was not confirmed.");
      }
      const refCheck = checkMediaReferences(id);
      if (refCheck.inUse) {
        throw new McpError(-32009, `Cannot delete media asset: currently referenced by ${refCheck.totalReferences} active entity record(s).`);
      }
      deleteMediaUploadSync(id);
      return { deleted: true, id };
    },
  },
  {
    name: "orders.getOrder",
    description: "Get one order with items (customer details included — token-gated like admin).",
    annotations: {
      title: "Get Order Details",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", required: ["orderId"], properties: { orderId: { type: "string", maxLength: 64 } } },
    run: (args) => {
      const order = getOrderFull(parse(getOrderArgs, args).orderId);
      if (!order) throw new McpError(-32004, "The requested order was not found.");
      return { order };
    },
  },
  {
    name: "orders.listOrders",
    description: "List orders filtered by payment/dispatch status, paginated.",
    annotations: {
      title: "List Orders",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        paymentStatus: { type: "string" },
        dispatchStatus: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    },
    run: (args) => ({ orders: listOrders(parse(listOrdersArgs, args)) }),
  },
  {
    name: "orders.setDispatchStatus",
    description: "Transition order fulfillment (illegal transitions rejected; beyond preparing requires paid). Optional idempotencyKey.",
    annotations: {
      title: "Set Order Dispatch Status",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["orderId", "to"],
      properties: { orderId: { type: "string" }, to: { type: "string" }, idempotencyKey: uuidProp },
    },
    run: (args) => {
      const { orderId, to, idempotencyKey } = parse(setDispatchArgs, args);
      return setDispatchStatusTx({ orderId, to, idempotencyKey });
    },
  },
  {
    name: "orders.cancelOrder",
    description: "Cancel an order (unfulfilled or preparing). Paid orders require gateway refund; delivered orders cannot be cancelled.",
    annotations: {
      title: "Cancel Unfulfilled Order",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["orderId"],
      properties: {
        orderId: { type: "string", maxLength: 64 },
        actor: { type: "string" },
        confirmed: { type: "boolean", description: "Confirmation flag to verify intentional cancellation of customer order." },
      },
    },
    run: (args) => {
      const { orderId, actor, confirm, confirmed } = parse(cancelOrderArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Order cancellation was not confirmed.");
      }
      return { order: cancelOrder(orderId, actor ?? "mcp") };
    },
  },
  {
    name: "orders.createDemoOrder",
    description: "Create a verified demo order for automated checkout testing, fulfillment validation, or sommelier demos.",
    annotations: {
      title: "Create Demo Order",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["name", "email", "address", "idempotencyKey", "items"],
      properties: {
        name: { type: "string" },
        email: { type: "string", format: "email" },
        address: { type: "string" },
        phone: { type: "string" },
        couponCode: { type: "string" },
        idempotencyKey: uuidProp,
        items: {
          type: "array",
          items: {
            type: "object",
            required: ["variantId", "quantity"],
            properties: {
              variantId: { type: "integer" },
              quantity: { type: "integer", minimum: 1 },
            },
          },
        },
      },
    },
    run: (args) => createDemoOrder(parse(createDemoOrderArgs, args)),
  },
  {
    name: "blog.listBlogPosts",
    description: "List editorial journal articles and educational guides. Optional status filter (draft, published, archived, all) and text search.",
    annotations: {
      title: "List Blog Posts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["draft", "published", "archived", "all"] },
        q: { type: "string", maxLength: 100 },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    },
    run: (args) => {
      const posts = listBlogPosts(parse(listBlogPostsArgs, args));
      return {
        posts,
        total: posts.length,
        specs_guide: {
          cover_image_recommended: "1200x675 (16:9)",
          supported_widgets: ["chart", "product", "figure", "tasting-radar", "steep-guide", "callout"],
        },
      };
    },
  },
  {
    name: "blog.getBlogPost",
    description: "Get full blog article by slug or numeric ID with comprehensive editorial analytics and widget specs.",
    annotations: {
      title: "Get Blog Post",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["slugOrId"],
      properties: { slugOrId: {} },
    },
    run: (args) => {
      const { slugOrId } = parse(getBlogPostArgs, args);
      const post = getBlogPost(slugOrId);
      if (!post) throw new McpError(-32004, "The requested article was not found.");
      return {
        post,
        specs: analyzeBlogSpecs(post.content, post),
      };
    },
  },
  {
    name: "blog.upsertBlogPost",
    description: "Create or update an educational blog article or buying guide. Optional idempotencyKey. Returns detailed specs.",
    annotations: {
      title: "Create or Update Blog Post",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["title", "content"],
      properties: {
        id: { type: "integer" },
        slug: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        summary: { type: "string" },
        excerpt: { type: "string" },
        cover_image_url: { type: "string" },
        cover_media_id: { type: "integer" },
        author_name: { type: "string" },
        status: { type: "string", enum: ["draft", "published", "archived"] },
        published_at: { type: "string" },
        seo_title: { type: "string" },
        seo_description: { type: "string" },
        canonical_override: { type: "string" },
        noindex: { type: "boolean" },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => {
      const input = parse(upsertBlogPostArgs, args);
      const reqDims = getRequiredDimensionsForEntity("blog");
      const required_dimensions = {
        recommended_width: reqDims.recommended_width,
        recommended_height: reqDims.recommended_height,
        aspect_ratio: reqDims.aspect_ratio,
        min_width: reqDims.min_width,
        min_height: reqDims.min_height,
        description: reqDims.description,
      };
      if (!input.idempotencyKey) {
        const post = upsertBlogPost(input);
        return { post, specs: analyzeBlogSpecs(post.content, post), required_dimensions, deduped: false };
      }
      const { body, deduped } = idempotent("blog_post", input.idempotencyKey, () => upsertBlogPost(input));
      const post = body as ReturnType<typeof upsertBlogPost>;
      return { post, specs: analyzeBlogSpecs(post.content, post), required_dimensions, deduped };
    },
  },
  {
    name: "blog.createBlogPost",
    description: "Create a new educational blog article or buying guide. Returns comprehensive editorial specs.",
    annotations: {
      title: "Create Blog Post",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["title", "content"],
      properties: {
        slug: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        summary: { type: "string" },
        excerpt: { type: "string" },
        cover_image_url: { type: "string" },
        cover_media_id: { type: "integer" },
        author_name: { type: "string" },
        status: { type: "string", enum: ["draft", "published", "archived"] },
        published_at: { type: "string" },
        seo_title: { type: "string" },
        seo_description: { type: "string" },
        canonical_override: { type: "string" },
        noindex: { type: "boolean" },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => {
      const input = parse(upsertBlogPostArgs, args);
      const reqDims = getRequiredDimensionsForEntity("blog");
      const required_dimensions = {
        recommended_width: reqDims.recommended_width,
        recommended_height: reqDims.recommended_height,
        aspect_ratio: reqDims.aspect_ratio,
        min_width: reqDims.min_width,
        min_height: reqDims.min_height,
        description: reqDims.description,
      };
      if (!input.idempotencyKey) {
        const post = upsertBlogPost(input);
        return { post, specs: analyzeBlogSpecs(post.content, post), required_dimensions, deduped: false };
      }
      const { body, deduped } = idempotent("blog_post", input.idempotencyKey, () => upsertBlogPost(input));
      const post = body as ReturnType<typeof upsertBlogPost>;
      return { post, specs: analyzeBlogSpecs(post.content, post), required_dimensions, deduped };
    },
  },
  {
    name: "blog.updateBlogPost",
    description: "Update an existing educational blog article or buying guide. Returns comprehensive editorial specs.",
    annotations: {
      title: "Update Blog Post",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["title", "content"],
      properties: {
        id: { type: "integer" },
        slug: { type: "string" },
        title: { type: "string" },
        content: { type: "string" },
        summary: { type: "string" },
        excerpt: { type: "string" },
        cover_image_url: { type: "string" },
        cover_media_id: { type: "integer" },
        author_name: { type: "string" },
        status: { type: "string", enum: ["draft", "published", "archived"] },
        published_at: { type: "string" },
        seo_title: { type: "string" },
        seo_description: { type: "string" },
        canonical_override: { type: "string" },
        noindex: { type: "boolean" },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => {
      const input = parse(upsertBlogPostArgs, args);
      const reqDims = getRequiredDimensionsForEntity("blog");
      const required_dimensions = {
        recommended_width: reqDims.recommended_width,
        recommended_height: reqDims.recommended_height,
        aspect_ratio: reqDims.aspect_ratio,
        min_width: reqDims.min_width,
        min_height: reqDims.min_height,
        description: reqDims.description,
      };
      if (!input.idempotencyKey) {
        const post = upsertBlogPost(input);
        return { post, specs: analyzeBlogSpecs(post.content, post), required_dimensions, deduped: false };
      }
      const { body, deduped } = idempotent("blog_post", input.idempotencyKey, () => upsertBlogPost(input));
      const post = body as ReturnType<typeof upsertBlogPost>;
      return { post, specs: analyzeBlogSpecs(post.content, post), required_dimensions, deduped };
    },
  },
  {
    name: "blog.deleteBlogPost",
    description: "Delete an article by slug or numeric ID.",
    annotations: {
      title: "Delete Blog Post",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["idOrSlug"],
      properties: {
        idOrSlug: {},
        confirmed: { type: "boolean", description: "Confirmation flag to verify intentional deletion of blog post." },
      },
    },
    run: (args) => {
      const { idOrSlug, confirm, confirmed } = parse(deleteBlogPostArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Blog post deletion was not confirmed.");
      }
      const deleted = deleteBlogPost(idOrSlug);
      if (!deleted) throw new McpError(-32004, "The requested article was not found.");
      return { deleted: true };
    },
  },
  {
    name: "store.getSettings",
    description: "Get store operational configuration: business name, currency, tax rate, shipping fees, free shipping threshold, contact email.",
    annotations: {
      title: "Get Store Operational Settings",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    run: () => ({ settings: getStoreSettings() }),
  },
  {
    name: "admin.updateSettings",
    description: "Update store operational configuration: store name, currency, tax rates, shipping rates, free shipping thresholds, contact email.",
    annotations: {
      title: "Update Store Settings",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        store_name: { type: "string", maxLength: 100 },
        "store-name": { type: "string", maxLength: 100 },
        storeName: { type: "string", maxLength: 100 },
        currency: { type: "string", maxLength: 10 },
        currency_code: { type: "string", maxLength: 10 },
        currencyCode: { type: "string", maxLength: 10 },
        tax_rate_percent: { type: "number", minimum: 0, maximum: 100 },
        gst_tax_rate_percent: { type: "number", minimum: 0, maximum: 100 },
        taxRate: { type: "number", minimum: 0, maximum: 100 },
        shipping_flat_fee_paise: { type: "integer", minimum: 0 },
        shipping_fee_paise: { type: "integer", minimum: 0 },
        shipping_flat_paise: { type: "integer", minimum: 0 },
        shippingFlatFeePaise: { type: "integer", minimum: 0 },
        free_shipping_threshold_paise: { type: "integer", minimum: 0 },
        freeShippingThresholdPaise: { type: "integer", minimum: 0 },
        contact_email: { type: "string", format: "email" },
        contactEmail: { type: "string", format: "email" },
        whatsapp_number: { type: "string", maxLength: 30 },
        whatsappNumber: { type: "string", maxLength: 30 },
      },
    },
    run: (args) => {
      const input = parse(updateSettingsArgs, args);
      return { settings: updateStoreSettings(input) };
    },
  },
  {
    name: "store.getHomepageContent",
    description: "Get structured homepage editorial content and media_guidance, including sample-kit artwork sizes: trials.image_url 1920x720 desktop (8:3), trials.mobile_image_url 960x1080 mobile (8:9), alt text and caption.",
    annotations: {
      title: "Get Homepage Content",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: { storefrontOnly: { type: "boolean" } },
    },
    run: (args) => {
      const { storefrontOnly } = parse(getHomepageArgs, args);
      const content = storefrontOnly ? getStorefrontHomepageContent() : getHomepageContent();
      return { content, media_guidance: { trials: HOME_TRIAL_MEDIA_GUIDANCE } };
    },
  },
  {
    name: "admin.updateHomepageContent",
    description: "Save the complete homepage content returned by store.getHomepageContent. Includes trials.image_url (desktop 1920x720), trials.mobile_image_url (mobile 960x1080), trials.image_alt and trials.image_caption. Keep other sections intact. Local image paths only. Returns media_guidance. Optional idempotencyKey.",
    annotations: {
      title: "Update Homepage Content",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["content"],
      properties: {
        content: { type: "object", description: "Complete homepage document. Editable trial artwork fields are listed below.", properties: {
          trials: { type: "object", properties: {
            image_url: { type: "string", description: "Desktop local image path. Recommended exact size 1920x720px, 8:3, centered cover crop." },
            mobile_image_url: { type: "string", description: "Mobile local image path. Recommended exact size 960x1080px, 8:9, shown at 640 CSS px and below." },
            image_alt: { type: "string", description: "Accessible description of the desktop and mobile artwork." },
            image_caption: { type: "string", description: "Visible caption. Keep an illustrative disclosure for generated art." },
          } },
        } },
        idempotencyKey: uuidProp,
        confirmed: { type: "boolean", description: "Confirmation flag to verify intentional update of homepage content." },
        publish: { type: "boolean", description: "Publish immediately to storefront." },
      },
    },
    run: (args) => {
      const input = parse(updateHomepageArgs, args);
      if (input.confirm === false || input.confirmed === false) {
        throw new McpError(-32009, "Homepage update was not confirmed.");
      }
      if (!input.idempotencyKey) {
        return { content: saveHomepageContent(input.content), deduped: false, media_guidance: { trials: HOME_TRIAL_MEDIA_GUIDANCE } };
      }
      const { body, deduped } = idempotent("homepage_content", input.idempotencyKey, () => saveHomepageContent(input.content));
      return { content: body, deduped, media_guidance: { trials: HOME_TRIAL_MEDIA_GUIDANCE } };
    },
  },
  {
    name: "admin.listSitePlacements",
    description: "List all visual site placements across the storefront with required image dimensions.",
    annotations: {
      title: "List Site Placements",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    run: () => ({ placements: listSitePlacements() }),
  },
  {
    name: "admin.getSitePlacement",
    description: "Get site placement details and required image dimensions by section_key.",
    annotations: {
      title: "Get Site Placement",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["section_key"],
      properties: {
        section_key: { type: "string" },
      },
    },
    run: (args) => {
      const { section_key } = parse(getSitePlacementArgs, args);
      const placement = getSitePlacement(section_key);
      if (!placement) throw new McpError(-32004, "The requested site placement was not found.");
      const reqDims = getRequiredDimensionsForEntity("site_placement", section_key);
      return { placement, required_dimensions: reqDims };
    },
  },
  {
    name: "admin.upsertSitePlacement",
    description: "Create or update visual site placement banner/section content (hero, craft, newsletter, values, etc.). Returns placement-specific required dimensions and aspect ratios.",
    annotations: {
      title: "Upsert Site Placement Banner",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["section_key"],
      properties: {
        section_key: { type: "string" },
        media_id: { type: "integer" },
        image_url: { type: "string" },
        alt_text: { type: "string" },
        title: { type: "string" },
        subtitle: { type: "string" },
        cta_label: { type: "string" },
        cta_href: { type: "string" },
      },
    },
    run: (args) => {
      const input = parse(upsertSitePlacementArgs, args);
      const placement = upsertSitePlacement(input);
      const reqDims = getRequiredDimensionsForEntity("site_placement", input.section_key);
      return {
        placement,
        required_dimensions: {
          recommended_width: reqDims.recommended_width,
          recommended_height: reqDims.recommended_height,
          aspect_ratio: reqDims.aspect_ratio,
          min_width: reqDims.min_width,
          min_height: reqDims.min_height,
          description: reqDims.description,
        },
      };
    },
  },
  {
    name: "admin.createSitePlacement",
    description: "Create visual site placement banner/section content. Returns placement-specific required dimensions.",
    annotations: {
      title: "Create Site Placement Banner",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["section_key"],
      properties: {
        section_key: { type: "string" },
        media_id: { type: "integer" },
        image_url: { type: "string" },
        alt_text: { type: "string" },
        title: { type: "string" },
        subtitle: { type: "string" },
        cta_label: { type: "string" },
        cta_href: { type: "string" },
      },
    },
    run: (args) => {
      const input = parse(upsertSitePlacementArgs, args);
      const placement = upsertSitePlacement(input);
      const reqDims = getRequiredDimensionsForEntity("site_placement", input.section_key);
      return {
        placement,
        required_dimensions: {
          recommended_width: reqDims.recommended_width,
          recommended_height: reqDims.recommended_height,
          aspect_ratio: reqDims.aspect_ratio,
          min_width: reqDims.min_width,
          min_height: reqDims.min_height,
          description: reqDims.description,
        },
      };
    },
  },
  {
    name: "admin.deleteSitePlacement",
    description: "Delete site placement banner by section_key.",
    annotations: {
      title: "Delete Site Placement",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["section_key"],
      properties: {
        section_key: { type: "string" },
        confirmed: { type: "boolean" },
      },
    },
    run: (args) => {
      const { section_key, confirm, confirmed } = parse(deleteSitePlacementArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Deletion was not confirmed.");
      }
      const deleted = deleteSitePlacement(section_key);
      if (!deleted) throw new McpError(-32004, "The requested site placement was not found.");
      return { deleted: true };
    },
  },
  {
    name: "admin.listUsers",
    description: "List staff accounts (username, email, role, active status, creation date). Never returns password hashes.",
    annotations: {
      title: "List Staff Users",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    run: () => ({ users: listAdminUsers() }),
  },
  {
    name: "admin.upsertUser",
    description: "Create or update staff user account (username, email, role, active status, optional new password). Protects last active root.",
    annotations: {
      title: "Create or Update Staff User",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["username"],
      properties: {
        id: { type: "integer" },
        username: { type: "string" },
        email: { type: "string", format: "email" },
        password: { type: "string" },
        role: { type: "string", enum: ["root", "admin"] },
        is_active: { type: "boolean" },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => {
      const input = parse(upsertUserArgs, args);
      if (!input.idempotencyKey) {
        return { user: upsertAdminUser(input), deduped: false };
      }
      const { body, deduped } = idempotent("admin_user", input.idempotencyKey, () => upsertAdminUser(input));
      return { user: body, deduped };
    },
  },
  {
    name: "admin.createUser",
    description: "Create a new staff user account. Protects last active root.",
    annotations: {
      title: "Create Staff User",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["username"],
      properties: {
        username: { type: "string" },
        email: { type: "string", format: "email" },
        password: { type: "string" },
        role: { type: "string", enum: ["root", "admin"] },
        is_active: { type: "boolean" },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => {
      const input = parse(upsertUserArgs, args);
      if (!input.idempotencyKey) {
        return { user: upsertAdminUser(input), deduped: false };
      }
      const { body, deduped } = idempotent("admin_user", input.idempotencyKey, () => upsertAdminUser(input));
      return { user: body, deduped };
    },
  },
  {
    name: "admin.updateUser",
    description: "Update staff user account by numeric ID or username.",
    annotations: {
      title: "Update Staff User",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "integer" },
        username: { type: "string" },
        email: { type: "string", format: "email" },
        password: { type: "string" },
        role: { type: "string", enum: ["root", "admin"] },
        is_active: { type: "boolean" },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => {
      const input = parse(upsertUserArgs, args);
      if (!input.idempotencyKey) {
        return { user: upsertAdminUser(input), deduped: false };
      }
      const { body, deduped } = idempotent("admin_user", input.idempotencyKey, () => upsertAdminUser(input));
      return { user: body, deduped };
    },
  },
  {
    name: "admin.deleteUser",
    description: "Delete staff user account by numeric ID (protects last active root).",
    annotations: {
      title: "Delete Staff User",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "integer" },
        confirmed: { type: "boolean", description: "Confirmation flag to verify intentional deletion of staff user." },
      },
    },
    run: (args) => {
      const { id, confirm, confirmed } = parse(deleteUserArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "User deletion was not confirmed.");
      }
      const deleted = deleteAdminUser(id);
      if (!deleted) throw new McpError(-32004, "The requested user was not found.");
      return { deleted: true };
    },
  },
  {
    name: "payments.recordIntent",
    description: "Record a payment intent (status only — never marks paid; amount must equal the order total). idempotencyKey is required; gatewayPaymentId links the later gateway callback.",
    annotations: {
      title: "Record Payment Intent",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["orderId", "amountPaise", "idempotencyKey"],
      properties: { orderId: { type: "string" }, amountPaise: { type: "integer", minimum: 0 }, idempotencyKey: uuidProp, gatewayPaymentId: { type: "string" } },
    },
    run: (args) => {
      const { orderId, amountPaise, idempotencyKey, gateway, gatewayPaymentId } = parse(recordIntentArgs, args);
      return recordIntent({ orderId, amountPaise, idempotencyKey, gateway, gatewayPaymentId });
    },
  },
  {
    name: "payments.applyWebhook",
    description: "Apply a gateway webhook verdict. HMAC verified with the server secret; paid captures stock + coupon atomically, refunds restock, double delivery dedupes, demo intents are rejected — never paid without verification.",
    annotations: {
      title: "Apply Gateway Payment Webhook",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["gatewayPaymentId", "status", "signature"],
      properties: { gatewayPaymentId: { type: "string" }, status: { type: "string" }, signature: { type: "string" }, amountPaise: { type: "integer", minimum: 0 } },
    },
    run: (args) => {
      const { gatewayPaymentId, status, signature, amountPaise } = parse(webhookArgs, args);
      return applyWebhook({ gatewayPaymentId, status, signature, amountPaise });
    },
  },
  {
    name: "analytics.listAbandonedCarts",
    description: "List active and abandoned carts with customer phone leads, device geolocation, recovery URLs, and WhatsApp outreach links.",
    annotations: {
      title: "List Abandoned Carts",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["all", "active", "abandoned", "contacted", "converted", "ignored"], default: "all" },
        has_phone: { type: "boolean", description: "Filter for carts with a captured phone number." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
        cursor: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(listAbandonedCartsArgs, args);
      return listAbandonedCarts(parsed);
    },
  },
  {
    name: "analytics.getAbandonedCartDetails",
    description: "Get full line items, tea grams, pricing, recovery URL, pre-generated WhatsApp message, and visitor fingerprint hardware/network signals for an abandoned cart.",
    annotations: {
      title: "Get Abandoned Cart Details",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["cart_id"],
      properties: {
        cart_id: { type: "string", description: "The abandoned cart ID." },
      },
    },
    run: (args) => {
      const { cart_id } = parse(getAbandonedCartDetailsArgs, args);
      const details = getAbandonedCartDetails(cart_id);
      if (!details) throw new McpError(-32004, "The requested cart was not found.");
      return details;
    },
  },
  {
    name: "analytics.updateAbandonedCartStatus",
    description: "Update the recovery status of an abandoned cart (abandoned, contacted, converted, ignored) with timestamped admin follow-up notes. Supports idempotencyKey.",
    annotations: {
      title: "Update Abandoned Cart Status",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["cart_id", "status"],
      properties: {
        cart_id: { type: "string", description: "The abandoned cart ID." },
        status: { type: "string", enum: ["abandoned", "contacted", "converted", "ignored"] },
        notes: { type: "string", maxLength: 500, description: "Follow-up recovery notes from customer contact." },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => {
      const parsed = parse(updateAbandonedCartStatusArgs, args);
      const res = updateAbandonedCartStatus(parsed);
      if (!res) throw new McpError(-32004, "The requested cart was not found.");
      return res;
    },
  },
  {
    name: "content.listPages",
    description: "List all static and editorial site pages (about, contact, shipping, returns, wholesale, brand, gifts, leaf-to-cup, locations, custom pages).",
    annotations: {
      title: "List Content Pages",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        published_only: { type: "boolean", description: "Filter for published pages only." },
        limit: { type: "integer", minimum: 1, maximum: 100 },
      },
    },
    run: (args) => ({ pages: listPages(parse(listPagesArgs, args)) }),
  },
  {
    name: "content.getPage",
    description: "Get full details, markdown body, hero media, and SEO metadata of a content page by slug.",
    annotations: {
      title: "Get Content Page",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string", description: "Page slug (e.g. about, shipping, returns, contact, brand, wholesale, leaf-to-cup, gifts, locations-siliguri, tea-finder)." },
      },
    },
    run: (args) => {
      const { slug } = parse(getPageArgs, args);
      const page = getPageBySlug(slug);
      if (!page) throw new McpError(-32004, `Page '${slug}' was not found.`);
      return { page };
    },
  },
  {
    name: "admin.upsertPage",
    description: "Create or update any site page (title, eyebrow, headline, subtitle, hero image, markdown body, sections JSON, SEO meta, published status).",
    annotations: {
      title: "Create or Update Content Page",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["slug", "title"],
      properties: {
        slug: { type: "string", description: "Unique URL slug identifier for the page." },
        title: { type: "string", description: "Page title." },
        eyebrow: { type: "string", description: "Small header eyebrow label." },
        headline: { type: "string", description: "Hero main headline." },
        subtitle: { type: "string", description: "Hero supporting subtitle." },
        hero_image_url: { type: "string", description: "Hero background or banner image URL." },
        hero_media_id: { type: "integer", description: "Media upload ID for hero image." },
        body_markdown: { type: "string", description: "Main editorial page markdown body text." },
        content: { type: "string", description: "Alias for body_markdown." },
        sections: { description: "Array of structured section objects or JSON string." },
        meta_title: { type: "string", description: "SEO title override." },
        meta_description: { type: "string", description: "SEO meta description override." },
        is_published: { type: "boolean", description: "Published state flag (default: true)." },
        idempotencyKey: uuidProp,
      },
    },
    run: (args) => {
      const input = parse(upsertPageMcpArgs, args);
      const execute = () => {
        const sectionsJson = typeof input.sections === "string" ? input.sections
          : (Array.isArray(input.sections) ? JSON.stringify(input.sections)
          : (typeof input.sections_json === "string" ? input.sections_json
          : (Array.isArray(input.sections_json) ? JSON.stringify(input.sections_json) : undefined)));

        const isPub = input.is_published !== undefined ? (input.is_published ? 1 : 0)
          : (input.isPublished !== undefined ? (input.isPublished ? 1 : 0) : 1);

        const page = upsertPage({
          slug: input.slug,
          title: input.title,
          eyebrow: input.eyebrow,
          headline: input.headline,
          subtitle: input.subtitle,
          hero_image_url: input.hero_image_url ?? input.heroImageUrl,
          hero_media_id: input.hero_media_id ?? input.heroMediaId,
          body_markdown: input.body_markdown ?? input.bodyMarkdown ?? input.content,
          sections_json: sectionsJson,
          meta_title: input.meta_title ?? input.metaTitle,
          meta_description: input.meta_description ?? input.metaDescription,
          is_published: isPub,
        });
        return page;
      };

      if (!input.idempotencyKey) {
        return { success: true, page: execute(), deduped: false };
      }
      const { body, deduped } = idempotent("site_page", input.idempotencyKey, execute);
      return { success: true, page: body, deduped };
    },
  },
  {
    name: "admin.deletePage",
    description: "Delete a custom or editorial content page by slug or numeric ID.",
    annotations: {
      title: "Delete Content Page",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Slug of the page to delete." },
        id: { type: "integer", description: "Numeric ID of the page." },
        slugOrId: { description: "Slug or numeric ID." },
        confirmed: { type: "boolean", description: "Confirmation flag to verify intentional deletion." },
      },
    },
    run: (args) => {
      const { slug, id, slugOrId, confirm, confirmed } = parse(deletePageArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Deletion was not confirmed.");
      }
      const target = slug ?? id ?? slugOrId;
      if (!target) throw new McpError(-32602, "Either slug or id is required.");
      const deleted = deletePage(target);
      if (!deleted) throw new McpError(-32004, "The requested page was not found.");
      return { deleted: true };
    },
  },
  {
    name: "content.getTextBlock",
    description: "Retrieve a specific site content text block by key (e.g. announcement.text, footer.tagline, shipping.dispatch_commitment, returns.window_days, etc.).",
    annotations: {
      title: "Get Site Text Content Block",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["key"],
      properties: {
        key: { type: "string", description: "Dot-notated text block key (e.g. announcement.text, footer.copyright)." },
        fallback: { type: "string", description: "Optional default fallback value if key does not exist." },
      },
    },
    run: (args) => {
      const { key, fallback } = parse(getTextBlockArgs, args);
      const record = getContentBlockRecord(key);
      const value = getContentBlock(key, fallback ?? "");
      return { key, content: value, record: record ?? null, exists: Boolean(record) };
    },
  },
  {
    name: "admin.updateTextBlock",
    description: "Create or update any site text content block (announcements, headers, footers, policies, microcopy, guarantee text). Immediately reflects across the entire website.",
    annotations: {
      title: "Update Site Text Content Block",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["key", "content"],
      properties: {
        key: { type: "string", description: "Unique dot-notated key (e.g. announcement.text, footer.tagline, brand.established_year)." },
        content: { type: "string", description: "Text, Markdown, HTML or JSON content string." },
        content_type: { type: "string", enum: ["text", "markdown", "html", "json"], description: "Content format (default: text)." },
        description: { type: "string", description: "Administrative description of where this block is used." },
      },
    },
    run: (args) => {
      const input = parse(updateTextBlockArgs, args);
      const cType = input.content_type ?? input.contentType ?? "text";
      const block = upsertContentBlock(input.key, input.content, input.description, cType);
      return { success: true, block };
    },
  },
  {
    name: "content.listTextBlocks",
    description: "List all site content text blocks, optionally filtered by key prefix (e.g. 'announcement.', 'footer.', 'shipping.', 'returns.').",
    annotations: {
      title: "List Site Text Content Blocks",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        prefix: { type: "string", description: "Optional key prefix to filter by." },
      },
    },
    run: (args) => {
      const { prefix } = parse(listTextBlocksArgs, args);
      const blocks = listContentBlocks(prefix);
      return { count: blocks.length, blocks };
    },
  },
  {
    name: "admin.deleteTextBlock",
    description: "Delete a site content text block by key.",
    annotations: {
      title: "Delete Site Text Content Block",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["key"],
      properties: {
        key: { type: "string", description: "Content block key." },
        confirmed: { type: "boolean", description: "Confirmation flag." },
      },
    },
    run: (args) => {
      const { key, confirm, confirmed } = parse(deleteTextBlockArgs, args);
      if (confirm === false || confirmed === false) {
        throw new McpError(-32009, "Deletion was not confirmed.");
      }
      const deleted = deleteContentBlock(key);
      if (!deleted) throw new McpError(-32004, `Content block '${key}' was not found.`);
      return { deleted: true, key };
    },
  },
  {
    name: "store.getAnnouncement",
    description: "Get current top announcement banner configuration (text, highlight badge, link URL, wholesale link, enabled state).",
    annotations: {
      title: "Get Top Announcement Banner",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    run: () => ({ announcement: getAnnouncementSettings() }),
  },
  {
    name: "admin.updateAnnouncement",
    description: "Update the site-wide top announcement banner text, link, and visibility. Live on all pages instantly.",
    annotations: {
      title: "Update Top Announcement Banner",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Announcement body text." },
        highlight: { type: "string", description: "Eyebrow highlight badge text (e.g. 'NEW HARVEST', 'SPRING FLUSH')." },
        link_url: { type: "string", description: "Destination URL when announcement is clicked." },
        link_label: { type: "string", description: "CTA button label (e.g. 'Explore Teas', 'Order Now')." },
        wholesale_label: { type: "string", description: "Wholesale inquiry link label." },
        enabled: { type: "boolean", description: "Enable or disable announcement bar visibility." },
      },
    },
    run: (args) => {
      const input = parse(updateAnnouncementMcpArgs, args);
      const updated = updateAnnouncementSettings({
        text: input.text,
        highlight: input.highlight,
        link_url: input.link_url ?? input.linkUrl,
        link_label: input.link_label ?? input.linkLabel,
        wholesale_label: input.wholesale_label ?? input.wholesaleLabel,
        enabled: input.enabled,
      });
      return { success: true, announcement: updated };
    },
  },
  {
    name: "store.getNavigation",
    description: "Get site header navigation links, footer navigation links, and brand text.",
    annotations: {
      title: "Get Site Navigation",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    run: () => ({ navigation: getSiteNavigation() }),
  },
  {
    name: "admin.updateNavigation",
    description: "Update header and footer navigation links across the entire storefront.",
    annotations: {
      title: "Update Site Navigation",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        brand: { type: "string" },
        tagline: { type: "string" },
        header_links: {
          type: "array",
          items: {
            type: "object",
            required: ["label", "href"],
            properties: { label: { type: "string" }, href: { type: "string" }, highlight: { type: "boolean" } }
          }
        },
        footer_links: {
          type: "array",
          items: {
            type: "object",
            required: ["label", "href"],
            properties: { label: { type: "string" }, href: { type: "string" } }
          }
        },
      },
    },
    run: (args) => {
      const input = parse(updateNavigationMcpArgs, args);
      const res = updateSiteNavigation(input);
      return { success: true, navigation: res };
    },
  },
  {
    name: "admin.updateFooter",
    description: "Update footer tagline, copyright, origin badge, and newsletter sign-up copy.",
    annotations: {
      title: "Update Site Footer Content",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        tagline: { type: "string", description: "Footer brand tagline." },
        copyright: { type: "string", description: "Copyright notice string." },
        badge: { type: "string", description: "Siliguri origin badge text." },
        newsletter_title: { type: "string", description: "Newsletter section heading." },
        newsletter_subtitle: { type: "string", description: "Newsletter section subtitle description." },
      },
    },
    run: (args) => {
      const input = parse(updateFooterMcpArgs, args);
      const updated: Record<string, string> = {};
      if (input.tagline !== undefined) {
        upsertContentBlock("footer.tagline", input.tagline, "Footer brand tagline", "text");
        updated.tagline = input.tagline;
      }
      if (input.copyright !== undefined) {
        upsertContentBlock("footer.copyright", input.copyright, "Footer copyright notice", "text");
        updated.copyright = input.copyright;
      }
      if (input.badge !== undefined) {
        upsertContentBlock("footer.badge", input.badge, "Footer origin badge", "text");
        updated.badge = input.badge;
      }
      const nlTitle = input.newsletter_title ?? input.newsletterTitle;
      if (nlTitle !== undefined) {
        upsertContentBlock("footer.newsletter_title", nlTitle, "Footer newsletter title", "text");
        updated.newsletter_title = nlTitle;
      }
      const nlSub = input.newsletter_subtitle ?? input.newsletterSubtitle;
      if (nlSub !== undefined) {
        upsertContentBlock("footer.newsletter_subtitle", nlSub, "Footer newsletter subtitle", "text");
        updated.newsletter_subtitle = nlSub;
      }
      return { success: true, updated };
    },
  },
  {
    name: "store.getStoreInfo",
    description: "Get unified store and brand configuration, contact information, Siliguri origin hub address, shipping commitments, and active policies.",
    annotations: {
      title: "Get Store & Brand Information",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    run: () => {
      const settings = getStoreSettings();
      const config = getDynamicSiteConfig();
      return {
        brand: {
          name: config.name,
          legalName: config.legalName,
          tagline: config.tagline,
          description: config.description,
        },
        contact: config.contact,
        address: config.address,
        openingHours: config.openingHours,
        shipping: config.shipping,
        returns: config.returns,
        social: config.sameAs,
        settings,
      };
    },
  },
  {
    name: "store.purgeMockupData",
    description: "Deeply scans and purges all mockup images, fake reviews, and unverified placeholder copy from all database tables (sliders, site_placements, categories, products, product_images, content_blocks) in both PostgreSQL and SQLite. Ensures 100% genuine data.",
    annotations: {
      title: "Purge All Mockup Data",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {},
    },
    run: () => {
      const result = purgeMockupData();
      return { success: true, ...result };
    },
  },
  {
    name: "email.listTemplates",
    description: "List every transactional email template (key, label, subject, variables) managed in the admin email editor.",
    annotations: {
      title: "List Email Templates",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    run: () => ({ templates: listEmailTemplates() }),
  },
  {
    name: "email.getTemplate",
    description: "Get one email template with subject, HTML/text bodies, variables, and a rendered preview using sample data.",
    annotations: {
      title: "Get Email Template",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["template_key"],
      properties: { template_key: { type: "string", maxLength: 80 } },
    },
    run: (args) => {
      const parsed = parse(z.object({ template_key: z.string().min(1).max(80) }), args);
      const template = getEmailTemplate(parsed.template_key);
      if (!template) throw new McpError(-32004, "Email template not found.");
      return { template, preview: renderEmailTemplate(template, {}), smtp: getSmtpStatus() };
    },
  },
  {
    name: "email.updateTemplate",
    description: "Update an email template subject, HTML body, and text body (same copy the admin editor saves).",
    annotations: {
      title: "Update Email Template",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["template_key", "subject", "html_body", "text_body"],
      properties: {
        template_key: { type: "string", maxLength: 80 },
        subject: { type: "string", maxLength: 200 },
        html_body: { type: "string", maxLength: 50000 },
        text_body: { type: "string", maxLength: 20000 },
      },
    },
    run: (args) => {
      const parsed = parse(
        z.object({
          template_key: z.string().min(1).max(80),
          subject: z.string().min(3).max(200),
          html_body: z.string().min(10).max(50000),
          text_body: z.string().min(10).max(20000),
        }),
        args
      );
      try {
        return { template: updateEmailTemplate(parsed.template_key, { subject: parsed.subject, html_body: parsed.html_body, text_body: parsed.text_body }) };
      } catch (error) {
        serviceError(error);
      }
    },
  },
  {
    name: "email.previewTemplate",
    description: "Render an email template with caller-supplied variables plus brand defaults (store name, support email, logo URL).",
    annotations: {
      title: "Preview Email Template",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["template_key"],
      properties: {
        template_key: { type: "string", maxLength: 80 },
        vars: { type: "object", additionalProperties: { type: "string" } },
      },
    },
    run: (args) => {
      const parsed = parse(
        z.object({ template_key: z.string().min(1).max(80), vars: z.record(z.string(), z.string()).optional() }),
        args
      );
      const template = getEmailTemplate(parsed.template_key);
      if (!template) throw new McpError(-32004, "Email template not found.");
      return { preview: renderEmailTemplate(template, parsed.vars ?? {}), defaults: defaultEmailContext() };
    },
  },
  {
    name: "email.sendTest",
    description: "Test-send a rendered email template via the configured SMTP relay (same conf the admin editor test uses). Returns sent:false with a preview when SMTP is not configured.",
    annotations: {
      title: "Send Email Test",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: true,
    },
    inputSchema: {
      type: "object",
      required: ["template_key", "to"],
      properties: {
        template_key: { type: "string", maxLength: 80 },
        to: { type: "string", format: "email" },
        vars: { type: "object", additionalProperties: { type: "string" } },
      },
    },
    run: (args) => {
      const parsed = parse(
        z.object({
          template_key: z.string().min(1).max(80),
          to: z.string().email(),
          vars: z.record(z.string(), z.string()).optional(),
        }),
        args
      );
      const template = getEmailTemplate(parsed.template_key);
      if (!template) throw new McpError(-32004, "Email template not found.");
      const smtp = getSmtpStatus();
      const preview = renderEmailTemplate(template, parsed.vars ?? {});
      if (!smtp.configured) {
        return { sent: false, reason: "SMTP is not configured. Set SMTP_HOST and retry.", smtp, preview };
      }
      // Delivery itself happens over the async SMTP relay; the MCP sandbox
      // reports the rendered preview plus relay conf without leaking secrets.
      return { sent: false, reason: "Test delivery is dispatched from the admin editor or API route using this preview and SMTP conf.", smtp, preview, to: parsed.to };
    },
  },
  {
    name: "email.getConfig",
    description: "Get redacted email relay configuration (host, port, TLS, from address, auth presence) plus brand logo references for templates.",
    annotations: {
      title: "Get Email Configuration",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    run: () => ({ smtp: getSmtpStatus(), logos: listLogoOptions(), defaults: defaultEmailContext() }),
  },
  {
    name: "email.generateDraft",
    description: "Generate an on-brand email draft (subject, HTML, text) from a goal prompt, tone, and optional CTA — same generator as the admin editor prompt box.",
    annotations: {
      title: "Generate Email Draft",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["goal"],
      properties: {
        goal: { type: "string", maxLength: 2000 },
        tone: { type: "string", enum: ["warm", "formal", "festive", "minimal"] },
        call_to_action: { type: "string", maxLength: 200 },
        logo_id: { type: "integer" },
        template_key: { type: "string", maxLength: 80 },
      },
    },
    run: (args) => {
      const parsed = parse(
        z.object({
          goal: z.string().min(8).max(2000),
          tone: z.enum(["warm", "formal", "festive", "minimal"]).optional(),
          call_to_action: z.string().max(200).optional(),
          logo_id: z.number().int().min(1).max(100).optional(),
          template_key: z.string().max(80).optional(),
        }),
        args
      );
      return { draft: generateEmailDraft({ goal: parsed.goal, tone: parsed.tone ?? "warm", call_to_action: parsed.call_to_action, logo_id: parsed.logo_id, template_key: parsed.template_key }) };
    },
  },
  {
    name: "blendLab.listPlans",
    description: "List all Blend Lab custom tea formulation and cupping service plans with pricing in paise and active status.",
    annotations: {
      title: "List Blend Lab Plans",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        activeOnly: { type: "boolean" },
      },
    },
    run: (args) => {
      const parsed = parse(listBlendLabPlansArgs, args);
      return { plans: listBlendLabPlans(parsed) };
    },
  },
  {
    name: "blendLab.getPlan",
    description: "Get a Blend Lab service plan by plan code (MATCH_QUOTE, QUALITY_AUDIT, SIGNATURE).",
    annotations: {
      title: "Get Blend Lab Plan",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["code"],
      properties: {
        code: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(getBlendLabPlanArgs, args);
      const plan = getBlendLabPlanByCode(parsed.code);
      if (!plan) throw new McpError(-32004, `Plan not found: ${parsed.code}`);
      return { plan };
    },
  },
  {
    name: "blendLab.upsertPlan",
    description: "Update or create a Blend Lab service plan (price in paise, tax rate in bps, title, features, exclusions, active toggle).",
    annotations: {
      title: "Upsert Blend Lab Plan",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["code", "totalPaise"],
      properties: {
        code: { type: "string", enum: ["MATCH_QUOTE", "QUALITY_AUDIT", "SIGNATURE"] },
        title: { type: "string" },
        eyebrow: { type: "string" },
        tagline: { type: "string" },
        description: { type: "string" },
        totalPaise: { type: "integer", minimum: 0 },
        taxRateBps: { type: "integer", minimum: 0, maximum: 10000 },
        active: { type: "boolean" },
        highlighted: { type: "boolean" },
        badge: { type: "string" },
        buttonLabel: { type: "string" },
        features: { type: "array", items: { type: "string" } },
        exclusions: { type: "array", items: { type: "string" } },
      },
    },
    run: (args) => {
      const parsed = parse(upsertBlendLabPlanArgs, args);
      const plan = upsertBlendLabPlan({
        ...parsed,
        badge: parsed.badge === null ? undefined : parsed.badge,
      });
      return { plan };
    },
  },
  {
    name: "blendLab.listProjects",
    description: "List Blend Lab customer intake submissions, sensory cupping briefs, and active custom formulations.",
    annotations: {
      title: "List Blend Lab Projects",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string" },
        paymentState: { type: "string" },
        planCode: { type: "string" },
        search: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 100 },
        offset: { type: "integer", minimum: 0 },
      },
    },
    run: (args) => {
      const parsed = parse(listBlendLabProjectsArgs, args);
      return listBlendLabProjects(parsed);
    },
  },
  {
    name: "blendLab.getProject",
    description: "Get full Blend Lab customer project details by internal ID or public ID, including sample info, commercial goals, sensory targets, and pickup address.",
    annotations: {
      title: "Get Blend Lab Project",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["idOrPublicId"],
      properties: {
        idOrPublicId: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(getBlendLabProjectArgs, args);
      const project = getBlendLabProjectByIdOrPublicId(parsed.idOrPublicId);
      if (!project) throw new McpError(-32004, `Project not found: ${parsed.idOrPublicId}`);
      return { project };
    },
  },
  {
    name: "blendLab.updateProject",
    description: "Update workflow state (e.g. draft_submitted, sample_received, tasting_in_progress, report_ready, completed), payment state, or internal cupping notes for a Blend Lab project.",
    annotations: {
      title: "Update Blend Lab Project",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["idOrPublicId"],
      properties: {
        idOrPublicId: { type: "string" },
        workflowState: { type: "string" },
        paymentState: { type: "string" },
        notes: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(updateBlendLabProjectArgs, args);
      const project = updateBlendLabProjectWorkflow(parsed.idOrPublicId, parsed);
      return { project };
    },
  },
  {
    name: "blendLab.listCoverage",
    description: "List postal PIN code courier serviceability configurations for Blend Lab sample pickups.",
    annotations: {
      title: "List Blend Lab Coverage",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        search: { type: "string" },
        limit: { type: "integer", minimum: 1, maximum: 200 },
        offset: { type: "integer", minimum: 0 },
      },
    },
    run: (args) => {
      const parsed = parse(listBlendLabCoverageArgs, args);
      return listBlendLabCoverage(parsed);
    },
  },
  {
    name: "blendLab.checkCoverage",
    description: "Check postal PIN code serviceability, carrier, and transit days for Blend Lab sample pickup.",
    annotations: {
      title: "Check Blend Lab Coverage",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["pincode"],
      properties: {
        pincode: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(checkBlendLabCoverageArgs, args);
      return checkBlendLabPincodeCoverage(parsed.pincode);
    },
  },
  {
    name: "blendLab.upsertCoverage",
    description: "Add or update postal PIN code serviceability for Blend Lab doorstep pickups.",
    annotations: {
      title: "Upsert Blend Lab Coverage",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["pincode", "city", "state"],
      properties: {
        pincode: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        carrier: { type: "string" },
        estimatedDays: { type: "integer", minimum: 1, maximum: 30 },
        serviceable: { type: "boolean" },
      },
    },
    run: (args) => {
      const parsed = parse(upsertBlendLabCoverageArgs, args);
      const coverage = upsertBlendLabCoverage(parsed);
      return { coverage };
    },
  },
  {
    name: "blendLab.deleteCoverage",
    description: "Delete a postal PIN code coverage override.",
    annotations: {
      title: "Delete Blend Lab Coverage",
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["pincode"],
      properties: {
        pincode: { type: "string" },
      },
    },
    run: (args) => {
      const parsed = parse(deleteBlendLabCoverageArgs, args);
      const success = deleteBlendLabCoverage(parsed.pincode);
      return { success };
    },
  },
  {
    name: "blendLab.getContent",
    description: "Get all Blend Lab marketing texts, landing hero placement, homepage discovery placement, and FAQ entries.",
    annotations: {
      title: "Get Blend Lab Content",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: { type: "object", properties: {} },
    run: () => getBlendLabContent(),
  },
  {
    name: "blendLab.updateContent",
    description: "Update Blend Lab marketing copy, hero image placement, homepage discovery placement, or FAQ items.",
    annotations: {
      title: "Update Blend Lab Content",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        homeEyebrow: { type: "string" },
        homeTitle: { type: "string" },
        homeDescription: { type: "string" },
        heroEyebrow: { type: "string" },
        heroTitle: { type: "string" },
        heroDescription: { type: "string" },
        heroImage: {
          type: "object",
          properties: {
            imageUrl: { type: "string" },
            altText: { type: "string" },
            title: { type: "string" },
            subtitle: { type: "string" },
            ctaLabel: { type: "string" },
            ctaHref: { type: "string" },
            mediaId: { type: "integer" },
          },
        },
        homeImage: {
          type: "object",
          properties: {
            imageUrl: { type: "string" },
            altText: { type: "string" },
            title: { type: "string" },
            subtitle: { type: "string" },
            ctaLabel: { type: "string" },
            ctaHref: { type: "string" },
            mediaId: { type: "integer" },
          },
        },
        faqs: {
          type: "array",
          items: {
            type: "object",
            required: ["question", "answer"],
            properties: {
              question: { type: "string" },
              answer: { type: "string" },
              category: { type: "string" },
            },
          },
        },
      },
    },
    run: (args) => {
      const parsed = parse(updateBlendLabContentArgs, args);
      return updateBlendLabContent(parsed);
    },
  },
  // ---------------------------------------------------------------------------
  // TeaFloww Trials v3 MCP Management Tools (12 Tools)
  // ---------------------------------------------------------------------------
  {
    name: "trial_list",
    description: "Query trials catalogue with status (draft, in_review, published, archived, all), tag, search, limit, offset, and sorting.",
    annotations: {
      title: "List Trials",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["all", "draft", "in_review", "published", "archived"],
          default: "all",
          description: "Filter trials by publication lifecycle status.",
        },
        tag: { type: "string", maxLength: 100, description: "Category or tag filter keyword." },
        search: { type: "string", maxLength: 100, description: "Search keyword matching title, slug, or SKU." },
        q: { type: "string", maxLength: 100, description: "Search query alias for search." },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20, description: "Maximum number of trials to return." },
        offset: { type: "integer", minimum: 0, default: 0, description: "Number of records to skip." },
        sort_by: { type: "string", enum: ["created_at", "updated_at", "title", "price_paise"], default: "updated_at" },
        sort_dir: { type: "string", enum: ["asc", "desc"], default: "desc" },
      },
    },
    run: (args) => {
      const parsed = parse(trialListArgs, args);
      const search = [parsed.search || parsed.q, parsed.tag].filter(Boolean).join(" ").trim() || undefined;
      return TrialService.list({
        status: parsed.status,
        search,
        limit: parsed.limit,
        offset: parsed.offset,
        sort_by: parsed.sort_by,
        sort_dir: parsed.sort_dir,
      });
    },
  },
  {
    name: "trial_get",
    description: "Retrieve complete trial dossier (including 4x50g components, 5-stage optical assets, brew guides, sensory tests, claims, and bulk links) by id or slug.",
    annotations: {
      title: "Get Trial",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "UUID or slug of the trial." },
        slug: { type: "string", maxLength: 120, description: "URL slug of the trial." },
        idOrSlug: { type: "string", description: "Identifier (UUID or slug) of the trial." },
      },
    },
    run: (args) => {
      const parsed = parse(trialGetArgs, args);
      const id = parsed.id || parsed.idOrSlug;
      const slug = parsed.slug || (parsed.idOrSlug && !parsed.id ? parsed.idOrSlug : undefined);
      const trial = (id ? (TrialService.getById(id) || TrialService.getBySlug(id)) : null)
        || (slug ? TrialService.getBySlug(slug) : null);
      if (!trial) throw new McpError(-32004, "Trial not found");
      return { ...trial, trial };
    },
  },
  {
    name: "trial_create",
    description: "Create draft trial kit with initial metadata (slug, title, price_paise, sku, etc.), auto-seeding 4 sachets, revision 1.",
    annotations: {
      title: "Create Trial Draft",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string", minLength: 3, maxLength: 180, description: "Title of the trial kit." },
        slug: { type: "string", maxLength: 120, description: "URL slug (kebab-case)." },
        tagline: { type: ["string", "null"], maxLength: 250 },
        description: { type: ["string", "null"], maxLength: 5000 },
        price_paise: { type: "integer", minimum: 0, default: 20000, description: "Price in paise." },
        compare_at_price_paise: { type: ["integer", "null"], minimum: 0 },
        cost_paise: { type: ["integer", "null"], minimum: 0 },
        sku: { type: "string", maxLength: 60 },
        inventory_quantity: { type: "integer", minimum: 0, default: 0 },
        inventory_policy: { type: "string", enum: ["track", "continue"], default: "track" },
        hero_image_id: { type: ["integer", "null"] },
        meta_title: { type: ["string", "null"], maxLength: 200 },
        meta_description: { type: ["string", "null"], maxLength: 500 },
        components: {
          type: "array",
          description: "Optional array of 4 initial sachet components (50g each).",
          items: {
            type: "object",
            required: ["slot_index", "name"],
            properties: {
              slot_index: { type: "integer", enum: [0, 1, 2, 3] },
              name: { type: "string", minLength: 2 },
              estate: { type: "string", default: "" },
              grade: { type: "string", default: "" },
              flush: { type: "string", default: "" },
              elevation: { type: ["string", "null"] },
              weight_g: { type: "integer", enum: [50], default: 50 },
              tasting_notes: { type: "array", items: { type: "string" } },
              brew_temp_c: { type: "integer", default: 95 },
              brew_time_sec: { type: "integer", default: 240 },
              leaf_dose_g: { type: "number", default: 2.5 },
            },
          },
        },
      },
    },
    run: (args) => {
      const parsed = parse(trialCreateArgs, args);
      const actor = getMcpAuditActor(args);
      const created = TrialService.createDraft(parsed as unknown as CreateTrialInput, actor);
      return { ...created, trial: created };
    },
  },
  {
    name: "trial_update",
    description: "Update trial metadata with CAS concurrency check: expected_revision.",
    annotations: {
      title: "Update Trial Metadata",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id", "expected_revision"],
      properties: {
        id: { type: "string", description: "UUID or slug of the trial." },
        expected_revision: { type: "integer", description: "Current revision number." },
        title: { type: "string", minLength: 3, maxLength: 180 },
        slug: { type: "string", maxLength: 120 },
        tagline: { type: ["string", "null"], maxLength: 250 },
        description: { type: ["string", "null"], maxLength: 5000 },
        price_paise: { type: "integer", minimum: 0 },
        compare_at_price_paise: { type: ["integer", "null"], minimum: 0 },
        cost_paise: { type: ["integer", "null"], minimum: 0 },
        sku: { type: "string", maxLength: 60 },
        inventory_quantity: { type: "integer", minimum: 0 },
        inventory_policy: { type: "string", enum: ["track", "continue"] },
        hero_image_id: { type: ["integer", "null"] },
        meta_title: { type: ["string", "null"], maxLength: 200 },
        meta_description: { type: ["string", "null"], maxLength: 500 },
      },
    },
    run: (args) => {
      const parsed = parse(trialUpdateArgs, args);
      const existing = TrialService.getById(parsed.id) || TrialService.getBySlug(parsed.id);
      if (!existing) throw new McpError(-32004, "Trial not found");
      const actor = getMcpAuditActor(args);
      const patch: UpdateTrialInput = {};
      if (parsed.title !== undefined) patch.title = parsed.title;
      if (parsed.slug !== undefined) patch.slug = parsed.slug;
      if (parsed.tagline !== undefined) patch.tagline = parsed.tagline;
      if (parsed.description !== undefined) patch.description = parsed.description;
      if (parsed.price_paise !== undefined) patch.price_paise = parsed.price_paise;
      if (parsed.compare_at_price_paise !== undefined) patch.compare_at_price_paise = parsed.compare_at_price_paise;
      if (parsed.cost_paise !== undefined) patch.cost_paise = parsed.cost_paise;
      if (parsed.sku !== undefined) patch.sku = parsed.sku;
      if (parsed.inventory_quantity !== undefined) patch.inventory_quantity = parsed.inventory_quantity;
      if (parsed.inventory_policy !== undefined) patch.inventory_policy = parsed.inventory_policy;
      if (parsed.hero_image_id !== undefined) patch.hero_image_id = parsed.hero_image_id;
      if (parsed.meta_title !== undefined) patch.meta_title = parsed.meta_title;
      if (parsed.meta_description !== undefined) patch.meta_description = parsed.meta_description;
      const updated = TrialService.update(existing.id, parsed.expected_revision, patch, actor);
      return { ...updated, trial: updated };
    },
  },
  {
    name: "trial_components_replace",
    description: "Replace all 4 sachet components, strictly enforcing 4x50g=200g invariant and CAS check: expected_revision.",
    annotations: {
      title: "Replace Trial Components",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id", "expected_revision", "components"],
      properties: {
        id: { type: "string", description: "UUID or slug of the trial." },
        expected_revision: { type: "integer", description: "Current revision number." },
        components: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          description: "Array of exactly 4 sachet components (50g each).",
          items: {
            type: "object",
            required: ["slot_index", "name"],
            properties: {
              slot_index: { type: "integer", enum: [0, 1, 2, 3] },
              name: { type: "string", minLength: 2 },
              estate: { type: "string", default: "" },
              grade: { type: "string", default: "" },
              flush: { type: "string", default: "" },
              elevation: { type: ["string", "null"] },
              weight_g: { type: "integer", enum: [50], default: 50 },
              quantity: { type: "integer", enum: [1], default: 1 },
              tasting_notes: { type: "array", items: { type: "string" } },
              brew_temp_c: { type: "integer", default: 95 },
              brew_time_sec: { type: "integer", default: 240 },
              leaf_dose_g: { type: "number", default: 2.5 },
              regular_product_id: { type: ["string", "integer", "null"] },
              regular_variant_id: { type: ["string", "integer", "null"] },
              sort_order: { type: "integer", default: 0 },
            },
          },
        },
      },
    },
    run: (args) => {
      const parsed = parse(trialComponentsReplaceArgs, args);
      const existing = TrialService.getById(parsed.id) || TrialService.getBySlug(parsed.id);
      if (!existing) throw new McpError(-32004, "Trial not found");
      const invariant = validateComponentInvariant(parsed.components);
      if (!invariant.valid) {
        throw new McpError(-32602, invariant.errors.join("; "));
      }
      const actor = getMcpAuditActor(args);
      const updated = TrialService.replaceComponents(existing.id, parsed.expected_revision, parsed.components as unknown as ComponentInput[], actor);
      return { ...updated, trial: updated };
    },
  },
  {
    name: "trial_media_attach",
    description: "Attach media asset to specific pouch slot (0..3) and stage, validating alt text and CAS check: expected_revision.",
    annotations: {
      title: "Attach Trial Media Asset",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id", "expected_revision", "stage", "alt_text"],
      properties: {
        id: { type: "string", description: "UUID or slug of the trial." },
        expected_revision: { type: "integer", description: "Current revision number." },
        slot_index: { type: ["integer", "null"], enum: [0, 1, 2, 3, null], description: "Pouch slot index (0..3) or null for kit-level." },
        stage: {
          type: "string",
          enum: ["packaging", "dry_leaf", "infused_leaf", "wet_leaf", "liquor", "milk_tea", "infusing", "sensory", "hero", "gallery"],
          description: "Photography stage.",
        },
        asset_url: { type: "string", description: "URL or path of media asset." },
        url: { type: "string", description: "Alias for asset_url." },
        media_id: { type: ["integer", "null"] },
        alt_text: { type: "string", minLength: 2, maxLength: 250, description: "Mandatory accessibility alt text." },
        caption: { type: ["string", "null"], maxLength: 250 },
        rights_status: { type: "string", enum: ["pending", "approved", "rejected"], default: "approved" },
        sort_order: { type: "integer", default: 0 },
      },
    },
    run: (args) => {
      const parsed = parse(trialMediaAttachArgs, args);
      const existing = TrialService.getById(parsed.id) || TrialService.getBySlug(parsed.id);
      if (!existing) throw new McpError(-32004, "Trial not found");
      const actor = getMcpAuditActor(args);
      const assetData: AssetInput = {
        component_id: parsed.component_id ?? null,
        slot_index: parsed.slot_index ?? null,
        media_id: parsed.media_id ?? null,
        asset_url: parsed.effective_url,
        stage: parsed.stage as AssetStage,
        alt_text: parsed.alt_text,
        caption: parsed.caption ?? null,
        rights_status: parsed.rights_status,
        sort_order: parsed.sort_order,
      };
      const updated = TrialService.attachAsset(existing.id, parsed.expected_revision, assetData, actor);
      return { ...updated, trial: updated };
    },
  },
  {
    name: "trial_validate",
    description: "Validate trial readiness and return publication blocker list (can_publish, blockers).",
    annotations: {
      title: "Validate Trial Readiness",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "UUID or slug of the trial to validate." },
      },
    },
    run: (args) => {
      const parsed = parse(trialValidateArgs, args);
      const existing = TrialService.getById(parsed.id) || TrialService.getBySlug(parsed.id);
      if (!existing) throw new McpError(-32004, "Trial not found");
      return TrialService.validate(existing.id);
    },
  },
  {
    name: "trial_submit_review",
    description: "Transition trial from draft to in_review with CAS check: expected_revision.",
    annotations: {
      title: "Submit Trial for Review",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id", "expected_revision"],
      properties: {
        id: { type: "string", description: "UUID or slug of the trial." },
        expected_revision: { type: "integer", description: "Current revision number." },
      },
    },
    run: (args) => {
      const parsed = parse(trialSubmitReviewArgs, args);
      const existing = TrialService.getById(parsed.id) || TrialService.getBySlug(parsed.id);
      if (!existing) throw new McpError(-32004, "Trial not found");
      const actor = getMcpAuditActor(args);
      const updated = TrialService.submitReview(existing.id, parsed.expected_revision, actor);
      return { ...updated, trial: updated };
    },
  },
  {
    name: "trial_publish",
    description: "Transition trial to published (evaluates publication blocker engine) with CAS check: expected_revision.",
    annotations: {
      title: "Publish Trial",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id", "expected_revision"],
      properties: {
        id: { type: "string", description: "UUID or slug of the trial." },
        expected_revision: { type: "integer", description: "Current revision number." },
      },
    },
    run: (args) => {
      const parsed = parse(trialPublishArgs, args);
      const existing = TrialService.getById(parsed.id) || TrialService.getBySlug(parsed.id);
      if (!existing) throw new McpError(-32004, "Trial not found");
      const actor = getMcpAuditActor(args);
      const updated = TrialService.publish(existing.id, parsed.expected_revision, actor);
      return { ...updated, trial: updated };
    },
  },
  {
    name: "trial_unpublish",
    description: "Transition trial from published back to draft with CAS check: expected_revision.",
    annotations: {
      title: "Unpublish Trial",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id", "expected_revision"],
      properties: {
        id: { type: "string", description: "UUID or slug of the trial." },
        expected_revision: { type: "integer", description: "Current revision number." },
      },
    },
    run: (args) => {
      const parsed = parse(trialUnpublishArgs, args);
      const existing = TrialService.getById(parsed.id) || TrialService.getBySlug(parsed.id);
      if (!existing) throw new McpError(-32004, "Trial not found");
      const actor = getMcpAuditActor(args);
      const updated = TrialService.unpublish(existing.id, parsed.expected_revision, actor);
      return { ...updated, trial: updated };
    },
  },
  {
    name: "trial_archive",
    description: "Transition trial to archived with CAS check: expected_revision.",
    annotations: {
      title: "Archive Trial",
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id", "expected_revision"],
      properties: {
        id: { type: "string", description: "UUID or slug of the trial." },
        expected_revision: { type: "integer", description: "Current revision number." },
      },
    },
    run: (args) => {
      const parsed = parse(trialArchiveArgs, args);
      const existing = TrialService.getById(parsed.id) || TrialService.getBySlug(parsed.id);
      if (!existing) throw new McpError(-32004, "Trial not found");
      const actor = getMcpAuditActor(args);
      const updated = TrialService.archive(existing.id, parsed.expected_revision, actor);
      return { ...updated, trial: updated };
    },
  },
  {
    name: "trial_history",
    description: "Retrieve chronological audit log (trial_audit).",
    annotations: {
      title: "Get Trial Audit History",
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string", description: "UUID or slug of the trial." },
      },
    },
    run: (args) => {
      const parsed = parse(trialHistoryArgs, args);
      const existing = TrialService.getById(parsed.id) || TrialService.getBySlug(parsed.id);
      if (!existing) throw new McpError(-32004, "Trial not found");
      const history = TrialService.getHistory(existing.id);
      return { history, total: history.length };
    },
  },
];

export function listToolDefinitions() {
  return TOOL_DEFINITIONS.map(({ name, description, inputSchema, annotations }) => ({
    name,
    description,
    inputSchema,
    ...(annotations ? { annotations } : {}),
  }));
}

export const listTools = listToolDefinitions;

const TOOL_ALIASES: Record<string, string> = {
  // Product aliases
  createProduct: "admin.createProduct",
  "admin.create_product": "admin.createProduct",
  create_product: "admin.createProduct",
  updateProduct: "admin.updateProduct",
  "admin.update_product": "admin.updateProduct",
  update_product: "admin.updateProduct",
  updateProductDetails: "admin.updateProductDetails",
  "admin.updateProductDetails": "admin.updateProductDetails",
  "admin.update_product_details": "admin.updateProductDetails",
  update_product_details: "admin.updateProductDetails",
  "product.updateDetails": "admin.updateProductDetails",
  "product.update_details": "admin.updateProductDetails",
  editProduct: "admin.updateProduct",
  "admin.editProduct": "admin.updateProduct",
  setProductStatus: "admin.setProductStatus",
  "admin.set_product_status": "admin.setProductStatus",
  set_product_status: "admin.setProductStatus",
  updateProductStatus: "admin.setProductStatus",
  "admin.updateProductStatus": "admin.setProductStatus",
  "admin.update_product_status": "admin.setProductStatus",
  update_product_status: "admin.setProductStatus",
  publishProduct: "admin.publishProduct",
  "admin.publish_product": "admin.publishProduct",
  publish_product: "admin.publishProduct",
  draftProduct: "admin.draftProduct",
  "admin.draft_product": "admin.draftProduct",
  draft_product: "admin.draftProduct",
  unpublishProduct: "admin.draftProduct",
  "admin.unpublishProduct": "admin.draftProduct",
  "admin.unpublish_product": "admin.draftProduct",
  unpublish_product: "admin.draftProduct",
  updateSteepingGuide: "admin.updateSteepingGuide",
  "admin.update_steeping_guide": "admin.updateSteepingGuide",
  update_steeping_guide: "admin.updateSteepingGuide",
  updateIngredients: "admin.updateIngredients",
  "admin.update_ingredients": "admin.updateIngredients",
  update_ingredients: "admin.updateIngredients",
  updateSensoryProfile: "admin.updateSensoryProfile",
  "admin.update_sensory_profile": "admin.updateSensoryProfile",
  update_sensory_profile: "admin.updateSensoryProfile",
  updateTastingNotes: "admin.updateSensoryProfile",
  "admin.updateTastingNotes": "admin.updateSensoryProfile",
  "admin.update_tasting_notes": "admin.updateSensoryProfile",
  update_tasting_notes: "admin.updateSensoryProfile",
  updateLeafProfile: "admin.updateLeafProfile",
  "admin.update_leaf_profile": "admin.updateLeafProfile",
  update_leaf_profile: "admin.updateLeafProfile",
  updateProvenance: "admin.updateProvenance",
  "admin.update_provenance": "admin.updateProvenance",
  update_provenance: "admin.updateProvenance",
  updateTerroir: "admin.updateProvenance",
  "admin.updateTerroir": "admin.updateProvenance",
  "admin.update_terroir": "admin.updateProvenance",
  update_terroir: "admin.updateProvenance",
  deleteProduct: "admin.deleteProduct",
  "admin.delete_product": "admin.deleteProduct",
  delete_product: "admin.deleteProduct",
  archiveProduct: "admin.archiveProduct",
  "admin.archive_product": "admin.archiveProduct",
  archive_product: "admin.archiveProduct",
  softDeleteProduct: "admin.softDeleteProduct",
  "admin.soft_delete_product": "admin.softDeleteProduct",
  soft_delete_product: "admin.softDeleteProduct",
  getProductSpecs: "store.getProductSpecs",
  "store.get_product_specs": "store.getProductSpecs",
  get_product_specs: "store.getProductSpecs",
  getProduct: "store.getProduct",
  listProducts: "store.listProducts",
  "admin.listProducts": "store.listProducts",
  "admin.list_products": "store.listProducts",
  upsertProduct: "admin.upsertProduct",

  // Variant aliases
  createVariant: "admin.createVariant",
  updateVariant: "admin.updateVariant",
  deleteVariant: "admin.deleteVariant",
  listVariants: "admin.listVariants",
  upsertVariant: "admin.upsertVariant",

  // Inventory aliases (canonical: inventory.updateStock)
  updateInventory: "inventory.updateStock",
  "inventory.update_inventory": "inventory.updateStock",
  update_inventory: "inventory.updateStock",
  updateStock: "inventory.updateStock",
  update_stock: "inventory.updateStock",
  "inventory.update_stock": "inventory.updateStock",
  "admin.updateInventory": "inventory.updateStock",
  "admin.update_inventory": "inventory.updateStock",
  "admin.updateStock": "inventory.updateStock",
  "admin.update_stock": "inventory.updateStock",

  // Category aliases
  createCategory: "admin.createCategory",
  updateCategory: "admin.updateCategory",
  deleteCategory: "admin.deleteCategory",
  getCategory: "store.getCategory",
  listCategories: "store.listCategories",
  upsertCategory: "admin.upsertCategory",

  // Images & Sliders
  createProductImage: "admin.createProductImage",
  deleteProductImage: "admin.deleteProductImage",
  listProductImages: "admin.listProductImages",
  createSlider: "admin.createSlider",
  updateSlider: "admin.updateSlider",
  deleteSlider: "admin.deleteSlider",
  listSliders: "store.listSliders",

  // Coupons
  createCoupon: "admin.createCoupon",
  updateCoupon: "admin.updateCoupon",
  deleteCoupon: "admin.deleteCoupon",
  getCoupon: "admin.getCoupon",
  listCoupons: "admin.listCoupons",
  validateCoupon: "store.validateCoupon",

  // Site Placements & Blogs
  getSitePlacement: "admin.getSitePlacement",
  listSitePlacements: "admin.listSitePlacements",
  createSitePlacement: "admin.createSitePlacement",
  deleteSitePlacement: "admin.deleteSitePlacement",
  createBlogPost: "blog.createBlogPost",
  updateBlogPost: "blog.updateBlogPost",
  deleteBlogPost: "blog.deleteBlogPost",
  getBlogPost: "blog.getBlogPost",
  listBlogPosts: "blog.listBlogPosts",

  // Users & Orders & Settings
  createUser: "admin.createUser",
  updateUser: "admin.updateUser",
  deleteUser: "admin.deleteUser",
  listUsers: "admin.listUsers",
  createDemoOrder: "orders.createDemoOrder",
  getOrder: "orders.getOrder",
  listOrders: "orders.listOrders",
  cancelOrder: "orders.cancelOrder",
  getSettings: "store.getSettings",
  updateSettings: "admin.updateSettings",

  // Media aliases
  replaceImage: "media.replaceImage",
  "media.replace_image": "media.replaceImage",
  replace_image: "media.replaceImage",

  // Pages aliases
  listPages: "content.listPages",
  "content.list_pages": "content.listPages",
  list_pages: "content.listPages",
  getPage: "content.getPage",
  "content.get_page": "content.getPage",
  get_page: "content.getPage",
  upsertPage: "admin.upsertPage",
  "admin.upsert_page": "admin.upsertPage",
  upsert_page: "admin.upsertPage",
  createPage: "admin.upsertPage",
  "admin.createPage": "admin.upsertPage",
  "admin.create_page": "admin.upsertPage",
  create_page: "admin.upsertPage",
  updatePage: "admin.upsertPage",
  "admin.updatePage": "admin.upsertPage",
  "admin.update_page": "admin.upsertPage",
  update_page: "admin.upsertPage",
  deletePage: "admin.deletePage",
  "admin.delete_page": "admin.deletePage",
  delete_page: "admin.deletePage",

  // Text Blocks aliases
  getTextBlock: "content.getTextBlock",
  "content.get_text_block": "content.getTextBlock",
  get_text_block: "content.getTextBlock",
  updateTextBlock: "admin.updateTextBlock",
  "admin.update_text_block": "admin.updateTextBlock",
  update_text_block: "admin.updateTextBlock",
  listTextBlocks: "content.listTextBlocks",
  "content.list_text_blocks": "content.listTextBlocks",
  list_text_blocks: "content.listTextBlocks",
  deleteTextBlock: "admin.deleteTextBlock",
  "admin.delete_text_block": "admin.deleteTextBlock",
  delete_text_block: "admin.deleteTextBlock",

  // Announcement aliases
  getAnnouncement: "store.getAnnouncement",
  "store.get_announcement": "store.getAnnouncement",
  get_announcement: "store.getAnnouncement",
  updateAnnouncement: "admin.updateAnnouncement",
  "admin.update_announcement": "admin.updateAnnouncement",
  update_announcement: "admin.updateAnnouncement",

  // Navigation & Footer aliases
  getNavigation: "store.getNavigation",
  "store.get_navigation": "store.getNavigation",
  get_navigation: "store.getNavigation",
  updateNavigation: "admin.updateNavigation",
  "admin.update_navigation": "admin.updateNavigation",
  update_navigation: "admin.updateNavigation",
  updateFooter: "admin.updateFooter",
  "admin.update_footer": "admin.updateFooter",
  update_footer: "admin.updateFooter",

  // Store Info alias
  getStoreInfo: "store.getStoreInfo",
  "store.get_store_info": "store.getStoreInfo",
  get_store_info: "store.getStoreInfo",

  // Blend Lab aliases
  listBlendLabPlans: "blendLab.listPlans",
  "blendLab.list_plans": "blendLab.listPlans",
  "admin.listBlendLabPlans": "blendLab.listPlans",
  getBlendLabPlan: "blendLab.getPlan",
  "blendLab.get_plan": "blendLab.getPlan",
  "admin.getBlendLabPlan": "blendLab.getPlan",
  upsertBlendLabPlan: "blendLab.upsertPlan",
  "blendLab.upsert_plan": "blendLab.upsertPlan",
  "admin.upsertBlendLabPlan": "blendLab.upsertPlan",
  listBlendLabProjects: "blendLab.listProjects",
  "blendLab.list_projects": "blendLab.listProjects",
  "admin.listBlendLabProjects": "blendLab.listProjects",
  getBlendLabProject: "blendLab.getProject",
  "blendLab.get_project": "blendLab.getProject",
  "admin.getBlendLabProject": "blendLab.getProject",
  updateBlendLabProject: "blendLab.updateProject",
  "blendLab.update_project": "blendLab.updateProject",
  "admin.updateBlendLabProject": "blendLab.updateProject",
  listBlendLabCoverage: "blendLab.listCoverage",
  "blendLab.list_coverage": "blendLab.listCoverage",
  "admin.listBlendLabCoverage": "blendLab.listCoverage",
  checkBlendLabCoverage: "blendLab.checkCoverage",
  "blendLab.check_coverage": "blendLab.checkCoverage",
  upsertBlendLabCoverage: "blendLab.upsertCoverage",
  "blendLab.upsert_coverage": "blendLab.upsertCoverage",
  "admin.upsertBlendLabCoverage": "blendLab.upsertCoverage",
  deleteBlendLabCoverage: "blendLab.deleteCoverage",
  "blendLab.delete_coverage": "blendLab.deleteCoverage",
  "admin.deleteBlendLabCoverage": "blendLab.deleteCoverage",
  getBlendLabContent: "blendLab.getContent",
  "blendLab.get_content": "blendLab.getContent",
  "admin.getBlendLabContent": "blendLab.getContent",
  updateBlendLabContent: "blendLab.updateContent",
  "blendLab.update_content": "blendLab.updateContent",
  "admin.updateBlendLabContent": "blendLab.updateContent",

  // TeaFloww Trials v3 Tool Aliases
  "trial.list": "trial_list",
  "trials.list": "trial_list",
  trialList: "trial_list",
  trialsList: "trial_list",
  trials_list: "trial_list",
  list_trials: "trial_list",
  "admin.trial_list": "trial_list",
  "admin.trial.list": "trial_list",
  "admin.trialList": "trial_list",

  "trial.get": "trial_get",
  "trials.get": "trial_get",
  trialGet: "trial_get",
  trialsGet: "trial_get",
  trials_get: "trial_get",
  get_trial: "trial_get",
  "admin.trial_get": "trial_get",
  "admin.trial.get": "trial_get",
  "admin.trialGet": "trial_get",

  "trial.create": "trial_create",
  "trials.create": "trial_create",
  trialCreate: "trial_create",
  trialsCreate: "trial_create",
  trials_create: "trial_create",
  create_trial: "trial_create",
  "admin.trial_create": "trial_create",
  "admin.trial.create": "trial_create",
  "admin.trialCreate": "trial_create",

  "trial.update": "trial_update",
  "trials.update": "trial_update",
  trialUpdate: "trial_update",
  trialsUpdate: "trial_update",
  trials_update: "trial_update",
  update_trial: "trial_update",
  "admin.trial_update": "trial_update",
  "admin.trial.update": "trial_update",
  "admin.trialUpdate": "trial_update",

  "trial.components_replace": "trial_components_replace",
  "trial.replace_components": "trial_components_replace",
  "trial.componentsReplace": "trial_components_replace",
  "trials.components_replace": "trial_components_replace",
  trialComponentsReplace: "trial_components_replace",
  trialsComponentsReplace: "trial_components_replace",
  trials_components_replace: "trial_components_replace",
  replace_trial_components: "trial_components_replace",
  "admin.trial_components_replace": "trial_components_replace",
  "admin.trial.components_replace": "trial_components_replace",
  "admin.trialComponentsReplace": "trial_components_replace",

  "trial.media_attach": "trial_media_attach",
  "trial.attach_media": "trial_media_attach",
  "trial.mediaAttach": "trial_media_attach",
  "trials.media_attach": "trial_media_attach",
  trialMediaAttach: "trial_media_attach",
  trialsMediaAttach: "trial_media_attach",
  trials_media_attach: "trial_media_attach",
  attach_trial_media: "trial_media_attach",
  "admin.trial_media_attach": "trial_media_attach",
  "admin.trial.media_attach": "trial_media_attach",
  "admin.trialMediaAttach": "trial_media_attach",

  "trial.validate": "trial_validate",
  "trials.validate": "trial_validate",
  trialValidate: "trial_validate",
  trialsValidate: "trial_validate",
  trials_validate: "trial_validate",
  validate_trial: "trial_validate",
  "admin.trial_validate": "trial_validate",
  "admin.trial.validate": "trial_validate",
  "admin.trialValidate": "trial_validate",

  "trial.submit_review": "trial_submit_review",
  "trial.submitReview": "trial_submit_review",
  "trials.submit_review": "trial_submit_review",
  trialSubmitReview: "trial_submit_review",
  trialsSubmitReview: "trial_submit_review",
  trials_submit_review: "trial_submit_review",
  submit_trial_review: "trial_submit_review",
  "admin.trial_submit_review": "trial_submit_review",
  "admin.trial.submit_review": "trial_submit_review",
  "admin.trialSubmitReview": "trial_submit_review",

  "trial.publish": "trial_publish",
  "trials.publish": "trial_publish",
  trialPublish: "trial_publish",
  trialsPublish: "trial_publish",
  trials_publish: "trial_publish",
  publish_trial: "trial_publish",
  "admin.trial_publish": "trial_publish",
  "admin.trial.publish": "trial_publish",
  "admin.trialPublish": "trial_publish",

  "trial.unpublish": "trial_unpublish",
  "trials.unpublish": "trial_unpublish",
  trialUnpublish: "trial_unpublish",
  trialsUnpublish: "trial_unpublish",
  trials_unpublish: "trial_unpublish",
  unpublish_trial: "trial_unpublish",
  "admin.trial_unpublish": "trial_unpublish",
  "admin.trial.unpublish": "trial_unpublish",
  "admin.trialUnpublish": "trial_unpublish",

  "trial.archive": "trial_archive",
  "trials.archive": "trial_archive",
  trialArchive: "trial_archive",
  trialsArchive: "trial_archive",
  trials_archive: "trial_archive",
  archive_trial: "trial_archive",
  "admin.trial_archive": "trial_archive",
  "admin.trial.archive": "trial_archive",
  "admin.trialArchive": "trial_archive",

  "trial.history": "trial_history",
  "trials.history": "trial_history",
  trialHistory: "trial_history",
  trialsHistory: "trial_history",
  trials_history: "trial_history",
  get_trial_history: "trial_history",
  "admin.trial_history": "trial_history",
  "admin.trial.history": "trial_history",
  "admin.trialHistory": "trial_history",
};

export function dispatchToolCall(name: unknown, args: unknown): unknown {
  if (typeof name !== "string") {
    throw new McpError(-32601, "Invalid tool name.");
  }
  let clean = name.trim();
  let effectiveArgs = args;
  if (
    clean === "admin.archiveProduct" ||
    clean === "archiveProduct" ||
    clean === "admin.archive_product" ||
    clean === "archive_product" ||
    clean === "admin.softDeleteProduct" ||
    clean === "softDeleteProduct" ||
    clean === "admin.soft_delete_product" ||
    clean === "soft_delete_product"
  ) {
    clean = "admin.deleteProduct";
    effectiveArgs = {
      ...(typeof args === "object" && args !== null ? args : {}),
      archive: true,
      confirmed: true,
    };
  } else if (TOOL_ALIASES[clean]) {
    clean = TOOL_ALIASES[clean];
  }
  const tool = TOOL_DEFINITIONS.find(
    (t) =>
      t.name === clean ||
      t.name.replace(/\./g, "_") === clean ||
      t.name.replace(/\./g, "-") === clean ||
      t.name.toLowerCase() === clean.toLowerCase() ||
      t.name.replace(/\./g, "_").toLowerCase() === clean.toLowerCase() ||
      t.name.replace(/\./g, "-").toLowerCase() === clean.toLowerCase() ||
      (t.name.startsWith("analytics.") &&
        (t.name.replace(/^analytics\./, "") === clean ||
          t.name.replace(/^analytics\./, "").toLowerCase() === clean.toLowerCase() ||
          t.name.replace(/^analytics\./, "").replace(/([A-Z])/g, "_$1").toLowerCase() === clean.toLowerCase()))
  );
  if (!tool) throw new McpError(-32601, "Unknown tool.");
  try {
    return tool.run(effectiveArgs);
  } catch (error) {
    serviceError(error);
  }
}

// ---------------------------------------------------------------------------
// Capability 2: Resources & Resource Templates
// ---------------------------------------------------------------------------

export type ResourceDef = {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  read: () => unknown;
};

export type ResourceTemplateDef = {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType: string;
};

export const RESOURCE_DEFINITIONS: ResourceDef[] = [
  {
    uri: "tea://catalog/products",
    name: "Full Tea Catalog",
    description: "Comprehensive product list with origins, harvest flushes, elevations, tasting notes, and variant pricing.",
    mimeType: "application/json",
    read: () => listProducts({}),
  },
  {
    uri: "tea://catalog/categories",
    name: "Tea Categories",
    description: "Active tea categories available in the store (e.g. Darjeeling, Assam, Nilgiri, White, Herbal).",
    mimeType: "application/json",
    read: () => listCategories({ activeOnly: true }),
  },
  {
    uri: "tea://catalog/sliders",
    name: "Homepage Featured Sliders",
    description: "Active editorial hero sliders and seasonal campaigns.",
    mimeType: "application/json",
    read: () => listSliders({ activeOnly: true }),
  },
  {
    uri: "tea://store/coupons",
    name: "Active Promotional Coupons",
    description: "Active promotional discount codes with discount percentages, flat values, and validity windows.",
    mimeType: "application/json",
    read: () => listCoupons().filter((c) => c.is_active === 1),
  },
  {
    uri: "tea://store/status",
    name: "Store Operational Status",
    description: "Live store health, total product count, active categories, and MCP protocol compliance.",
    mimeType: "application/json",
    read: () => {
      const products = listProducts({});
      const categories = listCategories({ activeOnly: true });
      const coupons = listCoupons().filter((c) => c.is_active === 1);
      return {
        status: "operational",
        store: "Himalayan Tea House",
        mcp_protocol_version: "2025-03-26",
        capabilities_coverage: "100%",
        counts: {
          products: products.length,
          categories: categories.length,
          coupons: coupons.length,
          tools: TOOL_DEFINITIONS.length,
        },
        currency: "INR",
      };
    },
  },
  {
    uri: "tea://orders/recent",
    name: "Recent Orders Manifest",
    description: "Recent orders summary (unfulfilled and active orders).",
    mimeType: "application/json",
    read: () => listOrders({ limit: 10 }),
  },
  {
    uri: "tea://media/recent",
    name: "Recent Media Assets",
    description: "Recently uploaded media assets in the media repository.",
    mimeType: "application/json",
    read: () => listMedia({ limit: 20 }).items,
  },
  {
    uri: "tea://media/requirements",
    name: "Media Dimension & Image Requirements",
    description: "Exact image dimension, aspect ratio, resolution, and format specifications for all storefront slots, product galleries, categories, sliders, site placements, and blogs.",
    mimeType: "application/json",
    read: () => getImageRequirements(),
  },
  {
    uri: "tea://store/settings",
    name: "Store Operational Settings",
    description: "Store name, currency, tax rates, shipping rates, free shipping threshold, and support email.",
    mimeType: "application/json",
    read: () => getStoreSettings(),
  },
  {
    uri: "tea://content/homepage",
    name: "Storefront Homepage Content",
    description: "Live storefront homepage structured editorial layout, hero sliders, and spotlight placements.",
    mimeType: "application/json",
    read: () => getStorefrontHomepageContent(),
  },
  {
    uri: "tea://content/blogs",
    name: "Published Tea Journal Articles",
    description: "Published articles, terroir guides, harvesting histories, and brewing tutorials.",
    mimeType: "application/json",
    read: () => listBlogPosts({ status: "published" }),
  },
  {
    uri: "tea://analytics/abandoned-carts",
    name: "Abandoned Carts & Visitor Intelligence Summary",
    description: "Real-time metrics on active and abandoned shopping carts, captured phone leads, and recovery conversion rates.",
    mimeType: "application/json",
    read: () => getAbandonedCartsResourceSummary(),
  },
  {
    uri: "tea://pages",
    name: "Site Content Pages",
    description: "All published and draft static/editorial content pages (about, contact, shipping, returns, wholesale, brand, gifts, leaf-to-cup, locations).",
    mimeType: "application/json",
    read: () => listPages({}),
  },
  {
    uri: "tea://announcement",
    name: "Top Announcement Bar",
    description: "Site-wide top announcement bar text, highlight label, link destination, and toggle state.",
    mimeType: "application/json",
    read: () => getAnnouncementSettings(),
  },
  {
    uri: "tea://navigation",
    name: "Storefront Navigation Links",
    description: "Header navigation links, footer navigation links, and brand text.",
    mimeType: "application/json",
    read: () => getSiteNavigation(),
  },
  {
    uri: "tea://blend-lab/plans",
    name: "Blend Lab Service Plans Catalog",
    description: "All Blend Lab service plans, prices in paise, tax rates, turnaround times, and entitlements.",
    mimeType: "application/json",
    read: () => listBlendLabPlans({ activeOnly: false }),
  },
  {
    uri: "tea://blend-lab/content",
    name: "Blend Lab Marketing Content & Placements",
    description: "Blend Lab headlines, copy, hero image placement, homepage discovery placement, and FAQ items.",
    mimeType: "application/json",
    read: () => getBlendLabContent(),
  },
  {
    uri: "tea://blend-lab/projects",
    name: "Blend Lab Intake Projects Manifest",
    description: "Recent Blend Lab customer intake submissions, cupping briefs, and active custom formulations.",
    mimeType: "application/json",
    read: () => listBlendLabProjects({ limit: 20 }),
  },
  {
    uri: "tea://content/blocks",
    name: "Site Content Text Blocks",
    description: "All editable site copy blocks across footer, guarantees, announcements, and microcopy.",
    mimeType: "application/json",
    read: () => listContentBlocks(),
  },
  {
    uri: "tea://email/templates",
    name: "Transactional Email Templates",
    description: "Every transactional email template (subject, HTML/text bodies, variables) plus redacted SMTP relay conf and brand logo references.",
    mimeType: "application/json",
    read: () => ({ templates: listEmailTemplates(), smtp: getSmtpStatus(), logos: listLogoOptions() }),
  },
];

export const RESOURCE_TEMPLATE_DEFINITIONS: ResourceTemplateDef[] = [
  {
    uriTemplate: "tea://products/{slug}",
    name: "Product by Slug",
    description: "Detailed single tea profile, brewing parameters, tasting notes, and variant inventory.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "tea://orders/{id}",
    name: "Order by Order ID",
    description: "Full order details, payment status, dispatch progression, and line items.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "tea://categories/{slug}",
    name: "Teas in Category",
    description: "Category profile and list of products belonging to this category.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "tea://media/{id}",
    name: "Media Asset by ID",
    description: "Complete asset metadata, dimensions, MIME type, and reference audit.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "tea://blogs/{slug}",
    name: "Journal Article by Slug or ID",
    description: "Full editorial content, markdown body, cover image, and SEO metadata.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "tea://site-placements/{section}",
    name: "Site Placement by Section Key",
    description: "Visual banner content, media asset binding, headings, and CTA button destinations.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "tea://pages/{slug}",
    name: "Content Page by Slug",
    description: "Full editorial page body, hero media image, sections JSON, and SEO metadata.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "tea://content/{key}",
    name: "Site Content Block by Key",
    description: "Single editable text or JSON content block (e.g. tea://content/footer.tagline).",
    mimeType: "application/json",
  },
];

export function listResourceDefinitions() {
  return RESOURCE_DEFINITIONS.map(({ uri, name, description, mimeType }) => ({
    uri,
    name,
    description,
    mimeType,
  }));
}

export function listResourceTemplateDefinitions() {
  return RESOURCE_TEMPLATE_DEFINITIONS.map(({ uriTemplate, name, description, mimeType }) => ({
    uriTemplate,
    name,
    description,
    mimeType,
  }));
}

export function dispatchResourceRead(uri: string): { contents: Array<{ uri: string; mimeType: string; text: string }> } {
  // Check static resources first
  const staticRes = RESOURCE_DEFINITIONS.find((r) => r.uri === uri);
  if (staticRes) {
    try {
      const data = staticRes.read();
      return {
        contents: [
          {
            uri: staticRes.uri,
            mimeType: staticRes.mimeType,
            text: JSON.stringify(data, null, 2),
          },
        ],
      };
    } catch (err) {
      serviceError(err);
    }
  }

  // Check dynamic URI patterns
  const productMatch = uri.match(/^tea:\/\/products\/([^/]+)$/);
  if (productMatch) {
    const slug = productMatch[1];
    const product = getProductBySlug(slug);
    if (!product) throw new McpError(-32004, `Product '${slug}' not found.`);
    const images = listProductImages(product.id);
    const specs = product.specs ?? getProductSpecs(product);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({ product, specs, images }, null, 2),
        },
      ],
    };
  }

  const orderMatch = uri.match(/^tea:\/\/orders\/([^/]+)$/);
  if (orderMatch) {
    const orderId = orderMatch[1];
    const order = getOrderFull(orderId);
    if (!order) throw new McpError(-32004, `Order '${orderId}' not found.`);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({ order }, null, 2),
        },
      ],
    };
  }

  const categoryMatch = uri.match(/^tea:\/\/categories\/([^/]+)$/);
  if (categoryMatch) {
    const catSlug = categoryMatch[1];
    const categories = listCategories({ activeOnly: false });
    const category = categories.find((c) => c.slug === catSlug);
    if (!category) throw new McpError(-32004, `Category '${catSlug}' not found.`);
    const products = listProducts({ category: catSlug });
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify({ category, products }, null, 2),
        },
      ],
    };
  }

  const mediaMatch = uri.match(/^tea:\/\/media\/(\d+)$/);
  if (mediaMatch) {
    const asset = getMediaById(Number(mediaMatch[1]));
    if (!asset) throw new McpError(-32004, `Media asset '${mediaMatch[1]}' not found.`);
    const w = asset.width;
    const h = asset.height;
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              ...asset,
              asset,
              dimensions: {
                width: w,
                height: h,
                aspect_ratio: w && h ? `${(w / h).toFixed(2)}:1` : null,
              },
              compatible_targets: getCompatibleSlots(w, h),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const blogMatch = uri.match(/^tea:\/\/blogs\/([^/]+)$/);
  if (blogMatch) {
    const slug = blogMatch[1];
    const post = getBlogPost(slug);
    if (!post) throw new McpError(-32004, `Blog article '${slug}' not found.`);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(post, null, 2),
        },
      ],
    };
  }

  const placementMatch = uri.match(/^tea:\/\/site-placements\/([^/]+)$/);
  if (placementMatch) {
    const key = placementMatch[1];
    const placement = getSitePlacement(key);
    if (!placement) throw new McpError(-32004, `Site placement '${key}' not found.`);
    const reqDims = getRequiredDimensionsForEntity("site_placement", key);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              ...placement,
              placement,
              required_dimensions: {
                recommended_width: reqDims.recommended_width,
                recommended_height: reqDims.recommended_height,
                aspect_ratio: reqDims.aspect_ratio,
                min_width: reqDims.min_width,
                min_height: reqDims.min_height,
                description: reqDims.description,
              },
            },
            null,
            2
          ),
        },
      ],
    };
  }

  const pageMatch = uri.match(/^tea:\/\/pages\/([^/]+)$/);
  if (pageMatch) {
    const slug = pageMatch[1];
    const page = getPageBySlug(slug);
    if (!page) throw new McpError(-32004, `Page '${slug}' not found.`);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(page, null, 2),
        },
      ],
    };
  }

  const contentMatch = uri.match(/^tea:\/\/content\/([^/]+)$/);
  if (contentMatch) {
    const key = contentMatch[1];
    const record = getContentBlockRecord(key);
    if (!record) throw new McpError(-32004, `Content block '${key}' not found.`);
    return {
      contents: [
        {
          uri,
          mimeType: "application/json",
          text: JSON.stringify(record, null, 2),
        },
      ],
    };
  }

  throw new McpError(-32004, `The requested resource was not found: ${uri}`);
}

// ---------------------------------------------------------------------------
// Capability 3: Prompts & Prompt Templates
// ---------------------------------------------------------------------------

export type PromptArgumentDef = {
  name: string;
  description: string;
  required?: boolean;
};

export type PromptMessage = {
  role: "user" | "assistant";
  content: { type: "text"; text: string };
};

export type PromptDef = {
  name: string;
  description: string;
  arguments?: PromptArgumentDef[];
  get: (args: Record<string, string>) => {
    description?: string;
    messages: PromptMessage[];
  };
};

export const PROMPT_DEFINITIONS: PromptDef[] = [
  {
    name: "tea-sommelier-recommendation",
    description: "Recommend artisanal Himalayan single-estate teas based on customer flavor profile, elevation preference, caffeine tolerance, and time of day.",
    arguments: [
      { name: "tasteProfile", description: "Desired flavor notes: muscatel, floral, vegetal, earthy, honey, smoky", required: false },
      { name: "caffeinePreference", description: "Preferred caffeine level: high, medium, low, caffeine-free", required: false },
      { name: "timeOfDay", description: "Time of intended consumption: morning, afternoon, evening", required: false },
    ],
    get: (args) => {
      const taste = args.tasteProfile || "any authentic profile";
      const caffeine = args.caffeinePreference || "any level";
      const time = args.timeOfDay || "any time";
      return {
        description: `Sommelier recommendation prompt for ${taste} notes (${caffeine} caffeine, ${time}).`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                "You are the master tea sommelier at Himalayan Tea House.",
                `The customer is seeking a tea recommendation with the following preferences:`,
                `- Desired flavor profile: ${taste}`,
                `- Caffeine level preference: ${caffeine}`,
                `- Intended consumption time: ${time}`,
                "",
                "Please use the 'store.listProducts' tool to inspect currently available teas in the catalog.",
                "Select 2-3 teas that best match these criteria. For each recommendation, explain:",
                "1. Exact estate provenance and harvest flush (e.g. Rohini First Flush, Glenburn Second Flush).",
                "2. Specific tasting notes and liquor color.",
                "3. Optimal brewing water temperature (°C) and steep duration (seconds).",
                "Be truthful, evocative, and never fabricate certifications or sourcing claims.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  },
  {
    name: "order-status-inquiry",
    description: "Draft an empathetic, truthful customer support update regarding fulfillment, payment verification, and delivery dispatch.",
    arguments: [
      { name: "orderId", description: "Order reference number (e.g. ord_...)", required: true },
      { name: "customerTone", description: "Customer tone: urgent, polite, inquiring", required: false },
    ],
    get: (args) => {
      const orderId = args.orderId;
      if (!orderId) throw new McpError(-32602, "The 'orderId' argument is required for order-status-inquiry.");
      const tone = args.customerTone || "polite";
      return {
        description: `Customer order inquiry for ${orderId} (${tone} tone).`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                "You are a customer care specialist at Himalayan Tea House.",
                `The customer contacted us regarding order '${orderId}' with a ${tone} tone.`,
                "",
                "Instructions:",
                `1. Call the 'orders.getOrder' tool with orderId: "${orderId}".`,
                "2. Review the order's payment status, dispatch status, tracking number (if any), and item summary.",
                "3. Compose a clear, reassuring, and honest response to the customer:",
                "   - If unpaid: explain that payment confirmation is pending before fulfillment.",
                "   - If preparing: confirm that the artisan tea packets are currently being freshly packed.",
                "   - If shipped: provide the dispatch status clearly.",
                "   - Never promise unrealistic delivery guarantees; keep copy truthful to our 3-5 business day commitment.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  },
  {
    name: "steeping-guide",
    description: "Generate precise Western and Gongfu brewing instructions for a selected tea, including temperature, leaf-to-water ratio, and multiple infusions.",
    arguments: [
      { name: "slug", description: "Catalog product slug (e.g. darjeeling-spring)", required: true },
      { name: "vessel", description: "Brewing vessel: gaiwan, western teapot, mug infuser", required: false },
    ],
    get: (args) => {
      const slug = args.slug;
      if (!slug) throw new McpError(-32602, "The 'slug' argument is required for steeping-guide.");
      const vessel = args.vessel || "traditional vessel";
      return {
        description: `Steeping guide for tea '${slug}' using a ${vessel}.`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `You are crafting a brewing guide for the tea '${slug}' using a ${vessel}.`,
                "1. Fetch the product details and brewing parameters using the 'store.getProduct' tool.",
                "2. Provide step-by-step preparation guidelines:",
                "   - Water quality and exact temperature (respecting product's brew_temp).",
                "   - Leaf weight in grams per 150ml of spring water.",
                "   - Infusion time for the first steep (respecting brew_seconds).",
                "   - Successive steep times and how the flavor profile evolves across 3-4 infusions.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  },
  {
    name: "inventory-restock-audit",
    description: "Audit inventory levels across all variants, identify low-stock items, and generate restock prioritization report.",
    arguments: [
      { name: "stockThreshold", description: "Stock count threshold below which variants are flagged (default: 5)", required: false },
    ],
    get: (args) => {
      const threshold = args.stockThreshold || "5";
      return {
        description: `Inventory restock audit with threshold of ${threshold} units.`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                "You are conducting a supply chain audit for Himalayan Tea House.",
                `The operational safety threshold is ${threshold} units.`,
                "1. Call 'store.listProducts' to get all active products.",
                "2. For each product, call 'store.getProduct' to inspect variant stock levels.",
                `3. Compile an executive summary of all variants with stock <= ${threshold}:`,
                "   - SKU, Grams, Current Stock, Price in INR.",
                "   - Restock urgency score (High for stock = 0, Medium for stock <= 3, Low for stock <= 5).",
                "   - Suggested reorder batch based on historical demand.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  },
  {
    name: "promotional-campaign-planner",
    description: "Design a seasonal campaign with coordinated discount coupons, hero slider messaging, and featured estate teas.",
    arguments: [
      { name: "season", description: "Season theme: spring, summer, autumn, winter, festive", required: true },
      { name: "discountPercent", description: "Target discount percentage (1–50)", required: false },
    ],
    get: (args) => {
      const season = args.season;
      if (!season) throw new McpError(-32602, "The 'season' argument is required for promotional-campaign-planner.");
      const discount = args.discountPercent || "15";
      return {
        description: `Campaign plan for ${season} season at ${discount}% discount.`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `You are the marketing strategist at Himalayan Tea House planning the ${season} campaign.`,
                `Target promotion: ${discount}% discount.`,
                "1. Use 'store.listCategories' and 'store.listProducts' to choose fitting seasonal teas.",
                "2. Propose:",
                `   - A memorable coupon code (e.g. ${season.toUpperCase()}${discount}).`,
                "   - Engaging, high-end hero banner title and subtitle.",
                "   - 3 spotlight teas that embody this harvest season.",
                "3. Ensure the coupon configuration respects our policy: max 50% discount and fair minimum spend.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  },
  {
    name: "generate_cart_recovery_message",
    description: "Generate tailored WhatsApp or SMS recovery message for an abandoned cart based on visitor bag teas and preferences.",
    arguments: [
      { name: "cart_id", description: "The abandoned cart ID", required: true },
    ],
    get: (args) => {
      const cartId = (args?.cart_id as string) || "";
      const details = getAbandonedCartDetails(cartId);
      if (!details) throw new McpError(-32004, "Cart not found.");
      return {
        description: "Tailored cart recovery outreach copy",
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Generate a polite, respectful WhatsApp cart recovery message for ${details.cart.customer_name || "a customer"} who added ${details.items.map((i) => `${i.product_name} (${i.grams}g)`).join(", ")}. Recovery URL: ${details.cart.recovery_url}`,
            },
          },
        ],
      };
    },
  },
  {
    name: "page-content-editor",
    description: "Draft, edit, or structure a complete editorial content page (e.g. About, Sourcing, Brand, Shipping, Wholesale, custom page) with narrative markdown, hero styling, and SEO meta tags.",
    arguments: [
      { name: "slug", description: "Target page slug (e.g. about, wholesale, brand, leaf-to-cup, or new custom slug)", required: true },
      { name: "theme", description: "Page theme or purpose (e.g. orthodox tea processing, artisan craft, corporate gifting, sustainable farming)", required: false },
    ],
    get: (args) => {
      const slug = args.slug;
      if (!slug) throw new McpError(-32602, "The 'slug' argument is required for page-content-editor.");
      const theme = args.theme || "artisanal tea culture";
      return {
        description: `Page editor prompt for '${slug}' focusing on ${theme}.`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                `You are crafting high-end editorial content for the page '${slug}' for Himalayan Tea House.`,
                `Core theme: ${theme}.`,
                "1. Use 'content.getPage' to inspect existing page content if available.",
                "2. Generate:",
                "   - Refined eyebrow badge (e.g. 'ORIGIN ARCHIVE', 'TRADE PARTNERSHIPS').",
                "   - Compelling hero headline and subtitle.",
                "   - Full markdown body with evocative headers, terroir context, and processing honesty.",
                "   - SEO meta title (<60 chars) and meta description (<160 chars).",
                "3. Use 'admin.upsertPage' to publish or preview the changes.",
                "Maintain truthful sourcing standards. Never fabricate certifications or awards.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  },
  {
    name: "announcement-banner-copywriter",
    description: "Compose engaging top announcement bar copy and highlight badge for a seasonal sale, new harvest drop, or free shipping offer.",
    arguments: [
      { name: "campaignTheme", description: "Campaign angle (e.g. Spring First Flush arrival, Festive Gifting, Flash Sale)", required: true },
      { name: "targetAudience", description: "Target buyer segment (e.g. tea connoisseurs, corporate gifters, new buyers)", required: false },
    ],
    get: (args) => {
      const theme = args.campaignTheme || "fresh harvest arrival";
      const audience = args.targetAudience || "all tea lovers";
      return {
        description: `Announcement copy prompt for ${theme} (${audience}).`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                "You are composing a high-conversion top announcement bar for Himalayan Tea House.",
                `Campaign angle: ${theme}. Target audience: ${audience}.`,
                "Requirements:",
                "1. Keep the body text concise (under 70 characters).",
                "2. Provide an eye-catching eyebrow badge (e.g. 'NEW HARVEST', 'LIMITED LOT').",
                "3. Provide a clear CTA button label and destination path (e.g. '/shop', '/pages/gifts').",
                "4. Use 'admin.updateAnnouncement' to deploy the copy directly to the site header.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  },
  {
    name: "site-rebranding-planner",
    description: "Audit and plan complete site rebranding updates across brand tagline, footer copyright, guarantee windows, and origin hub contact details.",
    arguments: [
      { name: "brandTagline", description: "New proposed brand tagline", required: false },
      { name: "returnWindowDays", description: "New return window in days", required: false },
    ],
    get: (args) => {
      const tagline = args.brandTagline || "Orthodox & CTC Teas from Origin";
      const windowDays = args.returnWindowDays || "14";
      return {
        description: `Site rebranding audit with tagline '${tagline}'.`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                "You are executing a site-wide content and branding refresh for Himalayan Tea House.",
                `Target tagline: "${tagline}". Return window: ${windowDays} days.`,
                "Steps:",
                "1. Read current settings using 'store.getStoreInfo' and content blocks via 'content.listTextBlocks'.",
                "2. Update brand copy blocks via 'admin.updateTextBlock' and 'admin.updateFooter'.",
                "3. Verify header and footer navigation links via 'store.getNavigation' and 'admin.updateNavigation'.",
                "4. Ensure all changes adhere to truthful origin details and Siliguri hub operations.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  },
  {
    name: "email-template-composer",
    description: "Compose on-brand transactional email copy (subject, HTML, plain text) for any store email template, with logo reference and test-send guidance.",
    arguments: [
      { name: "templateKey", description: "Target template key (e.g. order_confirmation, newsletter_welcome, abandoned_cart_recovery)", required: false },
      { name: "goal", description: "Email goal in plain words (e.g. festive First Flush announcement with 15% off)", required: true },
      { name: "tone", description: "Copy tone: warm, formal, festive, minimal", required: false },
    ],
    get: (args) => {
      const templateKey = args.templateKey || "newsletter_welcome";
      const goal = args.goal || "seasonal harvest update";
      const tone = args.tone || "warm";
      const template = getEmailTemplate(templateKey);
      const logos = listLogoOptions().slice(0, 5).map((l) => `${l.name} (${l.pngUrl})`).join("; ");
      return {
        description: `Email composer for '${templateKey}' (${tone}): ${goal}.`,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: [
                "You are the TeaFloww email copywriter (Nirva, Siliguri origin hub).",
                `Goal: ${goal}. Tone: ${tone}. Target template: '${templateKey}'.`,
                template ? `Current subject: "${template.subject}". Declared variables: ${template.variables.join(", ")}.`
                  : "This is a new template angle; keep variables to store_name, support_email, logo_url plus order/customer specifics.",
                "1. Read live defaults via 'email.getConfig' (store name, support email, absolute logo URLs).",
                `2. Suitable logo references: ${logos}. Prefer the Light Forest Green lockup on cream.`,
                "3. Draft: subject (<70 chars), HTML body (Georgia serif, max 560px, single logo <img> with absolute URL, one clear CTA), plain-text mirror.",
                "4. Generate the draft with 'email.generateDraft', preview with 'email.previewTemplate', then hand the copy to the operator to paste into /admin/emails.",
                "5. Remind the operator to test-send from the editor before relying on it — delivery uses the configured SMTP relay.",
                "Never fabricate harvest dates, certifications, or delivery promises.",
              ].join("\n"),
            },
          },
        ],
      };
    },
  },
];

export function listPromptDefinitions() {
  return PROMPT_DEFINITIONS.map(({ name, description, arguments: args }) => ({
    name,
    description,
    arguments: args ?? [],
  }));
}

export function dispatchPromptGet(name: unknown, args: unknown): unknown {
  const prompt = PROMPT_DEFINITIONS.find((p) => p.name === name);
  if (!prompt) throw new McpError(-32601, `Unknown prompt: ${name}`);
  const recordArgs: Record<string, string> = {};
  if (args && typeof args === "object") {
    for (const [k, v] of Object.entries(args as Record<string, unknown>)) {
      if (typeof v === "string") recordArgs[k] = v;
      else if (typeof v === "number" || typeof v === "boolean") recordArgs[k] = String(v);
    }
  }
  try {
    return prompt.get(recordArgs);
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(-32603, "Failed to generate prompt template.");
  }
}

// ---------------------------------------------------------------------------
// Capability 4: Logging (RFC 5424 levels)
// ---------------------------------------------------------------------------

const LOG_LEVELS = ["debug", "info", "notice", "warning", "error", "critical", "alert", "emergency"] as const;
export type McpLogLevel = typeof LOG_LEVELS[number];
let currentMcpLogLevel: McpLogLevel = "info";

export function setMcpLogLevel(level: unknown): { ok: boolean; level: McpLogLevel } {
  if (typeof level !== "string" || !LOG_LEVELS.includes(level as McpLogLevel)) {
    throw new McpError(-32602, `Invalid log level. Allowed levels: ${LOG_LEVELS.join(", ")}`);
  }
  currentMcpLogLevel = level as McpLogLevel;
  return { ok: true, level: currentMcpLogLevel };
}

export function getMcpLogLevel(): McpLogLevel {
  return currentMcpLogLevel;
}

// ---------------------------------------------------------------------------
// Capability 5: Completion (Autocomplete context)
// ---------------------------------------------------------------------------

export function dispatchCompletion(ref: unknown, argument: unknown): { completion: { values: string[]; total: number; hasMore: boolean } } {
  const arg = (argument ?? {}) as { name?: unknown; value?: unknown };
  const argName = typeof arg.name === "string" ? arg.name : "";
  const prefix = typeof arg.value === "string" ? arg.value.toLowerCase() : "";

  let values: string[] = [];

  if (argName === "slug" || argName === "blogSlug" || argName === "pageSlug") {
    const products = listProducts({});
    const blogs = listBlogPosts({});
    const pages = listPages({});
    values = [
      ...products.map((p) => p.slug),
      ...blogs.map((b) => b.slug),
      ...pages.map((p) => p.slug),
    ].filter((s) => s.toLowerCase().includes(prefix));
  } else if (argName === "key" || argName === "contentKey" || argName === "textBlockKey") {
    const blocks = listContentBlocks();
    values = blocks.map((b) => b.key).filter((k) => k.toLowerCase().includes(prefix));
  } else if (argName === "category") {
    const categories = listCategories({ activeOnly: true });
    values = categories.map((c) => c.slug).filter((s) => s.toLowerCase().includes(prefix));
  } else if (argName === "code" || argName === "coupon") {
    const coupons = listCoupons();
    values = coupons.map((c) => c.code).filter((c) => c.toLowerCase().includes(prefix));
  } else if (argName === "username") {
    const users = listAdminUsers();
    values = users.map((u) => u.username).filter((u) => u.toLowerCase().includes(prefix));
  } else if (argName === "section_key" || argName === "section") {
    const placements = listSitePlacements();
    values = placements.map((p) => p.section_key).filter((k) => k.toLowerCase().includes(prefix));
  } else if (argName === "settingKey") {
    values = ["store_name", "currency", "tax_rate_percent", "shipping_flat_fee_paise", "free_shipping_threshold_paise", "contact_email"].filter((k) => k.toLowerCase().includes(prefix));
  } else if (argName === "timeOfDay") {
    values = ["morning", "afternoon", "evening"].filter((t) => t.toLowerCase().includes(prefix));
  } else if (argName === "caffeinePreference") {
    values = ["high", "medium", "low", "caffeine-free"].filter((c) => c.toLowerCase().includes(prefix));
  } else if (argName === "vessel") {
    values = ["gaiwan", "western teapot", "kyusu", "mug infuser"].filter((v) => v.toLowerCase().includes(prefix));
  } else if (argName === "season") {
    values = ["spring", "summer", "autumn", "winter", "festive"].filter((s) => s.toLowerCase().includes(prefix));
  } else if (argName === "tasteProfile") {
    values = ["muscatel", "floral", "vegetal", "earthy", "smoky", "woody", "honey", "fruity"].filter((t) => t.toLowerCase().includes(prefix));
  } else if (argName === "entity_type" || argName === "target" || argName === "placement") {
    values = ["product", "category", "slider", "site_placement", "blog", "page", "content_block"].filter((e) => e.toLowerCase().includes(prefix));
  } else if (argName === "mime_type" || argName === "mimeType") {
    values = [...ALLOWED_MIME_TYPES].filter((m) => m.toLowerCase().includes(prefix));
  } else if (argName === "template_key" || argName === "templateKey" || argName === "emailTemplate") {
    values = listEmailTemplates().map((t) => t.key).filter((k) => k.toLowerCase().includes(prefix));
  } else if (argName === "tone") {
    values = ["warm", "formal", "festive", "minimal"].filter((t) => t.toLowerCase().includes(prefix));
  } else if (argName === "planCode" || argName === "plan") {
    values = ["MATCH_QUOTE", "QUALITY_AUDIT", "SIGNATURE"].filter((p) => p.toLowerCase().includes(prefix));
  } else if (argName === "workflowState" || argName === "projectStatus") {
    values = [
      "draft_submitted",
      "awaiting_payment",
      "paid",
      "pickup_requested",
      "awaiting_sample",
      "sample_received",
      "tasting_in_progress",
      "report_ready",
      "quote_ready",
      "trial_dispatch_pending",
      "trial_in_transit",
      "completed",
      "cancelled",
    ].filter((s) => s.toLowerCase().includes(prefix));
  } else if (argName === "paymentState") {
    values = ["draft", "pending", "paid", "refund_pending", "refunded"].filter((s) => s.toLowerCase().includes(prefix));
  }

  return {
    completion: {
      values: values.slice(0, 50),
      total: values.length,
      hasMore: values.length > 50,
    },
  };
}

// ---------------------------------------------------------------------------
// 100% Capabilities Declaration
// ---------------------------------------------------------------------------

export const MCP_CAPABILITIES = {
  tools: { listChanged: true },
  resources: { subscribe: true, listChanged: true },
  prompts: { listChanged: true },
  logging: {},
  completion: {},
} as const;
