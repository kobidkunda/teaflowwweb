import { getContentBlock, upsertContentBlock } from "@/lib/contentBlocks";
import { getSitePlacement, upsertSitePlacement, type SitePlacement } from "@/lib/media";

export interface BlendLabFaqItem {
  question: string;
  answer: string;
  category?: string;
}

export const DEFAULT_BLEND_LAB_FAQS: BlendLabFaqItem[] = [
  {
    question: "How much sample tea do I need to provide?",
    answer:
      "We recommend shipping a minimum of 100g of dry leaf for Match & Quote and Tea Quality Audit, and 200g for Signature Blend Lab. This provides enough material for dry visual inspection, sieve mesh particle analysis, repeated water and milk infusions, and reserve retention.",
  },
  {
    question: "How does the included doorstep courier pickup work?",
    answer:
      "After submitting your intake project online, our logistics partners (Blue Dart, Delhivery, or regional express cargo) generate a pre-paid pickup slip. You simply place your sample into an airtight pouch or tin, label it with your project ID, and hand it to the courier. If your postal code is in an unserviceable remote zone, we provide direct lab self-dispatch instructions.",
  },
  {
    question: "How are confidential recipe formulas protected?",
    answer:
      "All submitted customer tea samples, proprietary blend ratios, and client details are strictly protected under mutual commercial confidentiality. TeaFloww will never disclose your blend ratios, cost savings, or supplier allocations to third parties or other clients.",
  },
  {
    question: "What is the difference between Tea Quality Audit and statutory lab testing?",
    answer:
      "Tea Quality Audit is a professional commercial sensory cupping and lot-matching service focused on professional tea tasting and practical sourcing guidance. It evaluates physical leaf, liquor color, briskness, milk curdling, and market pricing. It is not an accredited statutory chemical safety assay (e.g. pesticide residue or heavy metal lab test), which requires third-party FSSAI-certified laboratory referral.",
  },
  {
    question: "What is the minimum order quantity (MOQ) for custom wholesale tea?",
    answer:
      "Following the delivery of your report or approved Signature trial blend, wholesale bulk production is offered with a standard proposed MOQ of 26 kg (equivalent to one standard commercial master bag / chest). We handle origin vacuum-sealing and logistics directly from Siliguri.",
  },
  {
    question: "What is the turnaround time for each tier?",
    answer:
      "Match & Quote takes approximately 5 business days from sample check-in. Tea Quality Audit delivers your PDF report in 7 business days. Signature Blend Lab involves physical candidate compounding, outbound trial dispatch, and client tasting, typically requiring 14 business days.",
  },
];

export interface BlendLabContentData {
  texts: {
    homeEyebrow: string;
    homeTitle: string;
    homeDescription: string;
    heroEyebrow: string;
    heroTitle: string;
    heroDescription: string;
  };
  heroPlacement: SitePlacement | null;
  homePlacement: SitePlacement | null;
  faqs: BlendLabFaqItem[];
}

export interface UpdateBlendLabContentInput {
  homeEyebrow?: string;
  homeTitle?: string;
  homeDescription?: string;
  heroEyebrow?: string;
  heroTitle?: string;
  heroDescription?: string;
  heroImage?: {
    imageUrl: string;
    altText?: string;
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    ctaHref?: string;
    mediaId?: number | null;
  };
  homeImage?: {
    imageUrl: string;
    altText?: string;
    title?: string;
    subtitle?: string;
    ctaLabel?: string;
    ctaHref?: string;
    mediaId?: number | null;
  };
  faqs?: BlendLabFaqItem[];
}

export function getBlendLabContent(): BlendLabContentData {
  const homeEyebrow = getContentBlock(
    "blend_lab.home_eyebrow",
    "CUSTOM TEA ATELIER"
  );
  const homeTitle = getContentBlock(
    "blend_lab.home_title",
    "Is your tea as competitive as it could be?"
  );
  const homeDescription = getContentBlock(
    "blend_lab.home_description",
    "From commercial matching to proprietary signature recipes. We source, cup, formulate, and deliver production-ready blends directly from the Himalayan foothills."
  );

  const heroEyebrow = getContentBlock(
    "blend_lab.hero_eyebrow",
    "TEAFLOWW BLEND LAB"
  );
  const heroTitle = getContentBlock(
    "blend_lab.hero_title",
    "Your tea. Our expertise. A better way to blend."
  );
  const heroDescription = getContentBlock(
    "blend_lab.hero_description",
    "Send your existing blend for professional tasting, practical quality insights and optional new formula development — designed around your taste and wholesale goals."
  );

  let faqs = DEFAULT_BLEND_LAB_FAQS;
  const rawFaqs = getContentBlock("blend_lab.faqs", "");
  if (rawFaqs.trim()) {
    try {
      const parsed = JSON.parse(rawFaqs);
      if (Array.isArray(parsed) && parsed.length > 0) {
        faqs = parsed;
      }
    } catch {
      // Keep default faqs on parse error
    }
  }

  const heroPlacement = getSitePlacement("blend_lab_hero");
  const homePlacement = getSitePlacement("home_blend_lab");

  return {
    texts: {
      homeEyebrow,
      homeTitle,
      homeDescription,
      heroEyebrow,
      heroTitle,
      heroDescription,
    },
    heroPlacement,
    homePlacement,
    faqs,
  };
}

export function updateBlendLabContent(input: UpdateBlendLabContentInput): BlendLabContentData {
  if (input.homeEyebrow !== undefined) {
    upsertContentBlock(
      "blend_lab.home_eyebrow",
      input.homeEyebrow.trim(),
      "text",
      "Blend Lab Homepage Discovery Eyebrow"
    );
  }

  if (input.homeTitle !== undefined) {
    upsertContentBlock(
      "blend_lab.home_title",
      input.homeTitle.trim(),
      "text",
      "Blend Lab Homepage Discovery Title"
    );
  }

  if (input.homeDescription !== undefined) {
    upsertContentBlock(
      "blend_lab.home_description",
      input.homeDescription.trim(),
      "text",
      "Blend Lab Homepage Discovery Description"
    );
  }

  if (input.heroEyebrow !== undefined) {
    upsertContentBlock(
      "blend_lab.hero_eyebrow",
      input.heroEyebrow.trim(),
      "text",
      "Blend Lab Hero Eyebrow"
    );
  }

  if (input.heroTitle !== undefined) {
    upsertContentBlock(
      "blend_lab.hero_title",
      input.heroTitle.trim(),
      "text",
      "Blend Lab Hero Title"
    );
  }

  if (input.heroDescription !== undefined) {
    upsertContentBlock(
      "blend_lab.hero_description",
      input.heroDescription.trim(),
      "text",
      "Blend Lab Hero Description"
    );
  }

  if (input.faqs !== undefined) {
    upsertContentBlock(
      "blend_lab.faqs",
      JSON.stringify(input.faqs),
      "json",
      "Blend Lab Frequently Asked Questions"
    );
  }

  if (input.heroImage) {
    upsertSitePlacement({
      section_key: "blend_lab_hero",
      image_url: input.heroImage.imageUrl,
      alt_text: input.heroImage.altText ?? "TeaFloww Blend Lab Atelier cupping table",
      title: input.heroImage.title ?? "TeaFloww Blend Lab",
      subtitle: input.heroImage.subtitle ?? "Sensory Cupping & Formulation Atelier",
      cta_label: input.heroImage.ctaLabel ?? "Explore Plans",
      cta_href: input.heroImage.ctaHref ?? "#plans",
      media_id: input.heroImage.mediaId ?? null,
    });
  }

  if (input.homeImage) {
    upsertSitePlacement({
      section_key: "home_blend_lab",
      image_url: input.homeImage.imageUrl,
      alt_text: input.homeImage.altText ?? "Blend Lab sensory cupping discovery",
      title: input.homeImage.title ?? "Blend Lab & Sensory Diagnostics",
      subtitle: input.homeImage.subtitle ?? "Custom tea formulation",
      cta_label: input.homeImage.ctaLabel ?? "Explore Blend Lab",
      cta_href: input.homeImage.ctaHref ?? "/blend-lab",
      media_id: input.homeImage.mediaId ?? null,
    });
  }

  return getBlendLabContent();
}
