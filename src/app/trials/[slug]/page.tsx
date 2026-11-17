import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema, getTrialProductSchema } from "@/lib/seo/schema";
import { resolveProductCommercePolicy, toClientCommercePolicy } from "@/lib/seo/productPolicy";
import { listApprovedReviews } from "@/lib/reviews";
import { ProductReviewsSection } from "@/components/ProductReviewsSection";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/adminSessions";
import { TrialService } from "@/lib/trials/service";
import { DraftPreviewBanner } from "@/components/trials/DraftPreviewBanner";
import { TrialPDPInteractiveView } from "@/components/trials/TrialPDPInteractiveView";
import { PDPTracker } from "@/components/analytics/PDPTracker";

export const dynamic = "force-dynamic";

async function verifyAdmin(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
    if (sessionCookie && verifySessionValue(sessionCookie)) {
      return true;
    }
    const headerList = await headers();
    const testToken = headerList.get("x-admin-test-token");
    const expectedToken = process.env.ADMIN_TEST_TOKEN;
    if (
      process.env.NODE_ENV !== "production" &&
      expectedToken &&
      expectedToken.length >= 16 &&
      testToken === expectedToken
    ) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const trial = TrialService.getBySlug(slug);

  if (!trial) {
    return constructMetadata({
      title: "Trial Kit Not Found | TeaFloww",
      description: "The requested craft tea trial kit could not be located in our Siliguri catalogue.",
      path: `/trials/${slug}`,
      noindex: true,
    });
  }

  const isPublished = trial.status === "published";
  const isAdmin = await verifyAdmin();

  if (!isPublished && !isAdmin) {
    return constructMetadata({
      title: "Trial Kit Not Found | TeaFloww",
      description: "The requested craft tea trial kit could not be located.",
      path: `/trials/${slug}`,
      noindex: true,
    });
  }

  const publicDto = TrialService.toPublicDto(trial, { allowDraftPreview: true });
  const heroUrl = publicDto.hero_image?.url || null;

  return constructMetadata({
    title: publicDto.meta?.title || `${publicDto.title} | TeaFloww Trials`,
    description:
      publicDto.meta?.description ||
      publicDto.description ||
      publicDto.tagline ||
      "Sample four 50g craft tea expressions with authentic garden provenance.",
    path: `/trials/${publicDto.slug}`,
    ogImage: heroUrl,
    noindex: !isPublished,
  });
}

export default async function TrialPDPPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const trial = TrialService.getBySlug(slug);

  if (!trial) {
    notFound();
  }

  // If accessed by UUID, redirect to canonical slug
  if (slug === trial.id && trial.slug && slug !== trial.slug) {
    redirect(`/trials/${trial.slug}`);
  }

  const isPublished = trial.status === "published";
  const isAdmin = await verifyAdmin();

  if (!isPublished && !isAdmin) {
    notFound();
  }

  const isDraftPreview = !isPublished && isAdmin;
  const publicDto = TrialService.toPublicDto(trial, { allowDraftPreview: true });

  const commercePolicy = resolveProductCommercePolicy({
    entityType: "trial",
    entityId: trial.id,
    overrides: publicDto.policy_overrides,
  });
  const approvedReviews = listApprovedReviews("trial", trial.id);
  const productJsonLd = getTrialProductSchema(publicDto, {
    policy: commercePolicy,
    reviews: approvedReviews,
  });
  const clientPolicy = toClientCommercePolicy(commercePolicy);

  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: "Trials", url: "/trials" },
    { name: publicDto.title, url: `/trials/${publicDto.slug}` },
  ]);

  return (
    <div className="tf-trial-pdp-shell bg-[#f7f2eb] text-[#0d0b0a] min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {isDraftPreview && (
        <DraftPreviewBanner
          status={trial.status}
          revision={trial.revision}
        />
      )}

      <PDPTracker
        product={{
          id: 9000,
          slug: `trials/${publicDto.slug}`,
          name: publicDto.title,
          category: "Trial Kit",
        }}
        variant={{
          id: 1,
          sku: publicDto.sku,
          price_paise: publicDto.price_paise,
        }}
      />

      <TrialPDPInteractiveView trial={publicDto} commercePolicy={clientPolicy} />

      <div className="max-w-[1260px] mx-auto px-4 md:px-6 pb-12">
        <ProductReviewsSection
          entityType="trial"
          entityId={trial.id}
          productName={publicDto.title}
          summary={commercePolicy.reviewSummary}
          reviews={approvedReviews}
        />
      </div>
    </div>
  );
}
