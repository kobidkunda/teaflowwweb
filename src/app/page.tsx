import { requestContext } from "@/lib/international/context";
import { localize } from "@/lib/international/translations";
import { activeCampaign } from "@/lib/international/campaigns";
import { listProducts } from "@/lib/products";
import { listCategories } from "@/lib/categories";
import { getSitePlacement } from "@/lib/media";
import { listSliders } from "@/lib/sliders";
import { getContentBlock } from "@/lib/contentBlocks";
import { getStorefrontHomepageContent } from "@/lib/homepage";
import { constructMetadata } from "@/lib/seo/metadata";
import { TrialService } from "@/lib/trials/service";
import { HomeHero } from "@/components/home/HomeHero";
import { CategoryCircles } from "@/components/home/CategoryCircles";
import { SignatureBlendsCarousel } from "@/components/home/SignatureBlendsCarousel";
import { HomeTrialsSection } from "@/components/home/HomeTrialsSection";
import { BentoStory } from "@/components/home/BentoStory";
import { BlendLabDiscoverySection } from "@/components/home/BlendLabDiscoverySection";
import { LeafToCupTeaser } from "@/components/home/LeafToCupTeaser";
import { TrustBar } from "@/components/home/TrustBar";
import { KindWords } from "@/components/home/KindWords";
import type { Metadata } from "next";
import { NewsletterSection } from "@/components/home/NewsletterSection";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const ctx = await requestContext();
  return constructMetadata({ path: "/", locale: ctx.requestedLocale || "en", resource: "homepage" });
}

export default async function Home() {
  const ctx = await requestContext();
  const active = activeCampaign(ctx.country);
  const campaign = active ? localize(active, `campaign:${active.id}`, ctx.locale) : null;
  const translatedBlock = (key: string, fallback: string) => localize({content: getContentBlock(key, fallback)}, `block:${key}`, ctx.locale).content;
  const categories = listCategories({ activeOnly: true }).map(c => localize(c, `category:${c.id}`, ctx.locale));
  const featuredProducts = listProducts({ featured: true });
  const baseProducts = campaign?.featuredIds.length ? listProducts().filter(p => campaign.featuredIds.includes(p.id)) : featuredProducts.length > 0 ? featuredProducts : listProducts().slice(0, 8);
  const products = baseProducts.map(p => localize(p, `product:${p.id}`, ctx.locale));

  const heroPlacement = localize(getSitePlacement("home_hero"), "placement:home_hero", ctx.locale);
  const storyPlacement = localize(getSitePlacement("home_story"), "placement:home_story", ctx.locale);
  const storyCollageTopPlacement = localize(getSitePlacement("home_story_collage_top"), "placement:home_story_collage_top", ctx.locale);
  const storyCollageBotPlacement = localize(getSitePlacement("home_story_collage_bot"), "placement:home_story_collage_bot", ctx.locale);
  const craftPlacement = localize(getSitePlacement("home_craft"), "placement:home_craft", ctx.locale);
  const newsletterPlacement = localize(getSitePlacement("home_newsletter"), "placement:home_newsletter", ctx.locale);
  let sliders = listSliders({ activeOnly: true, pageTarget: "home" }).map(s => localize(s, `slider:${s.id}`, ctx.locale));
  if (campaign?.sliderIds.length) sliders = sliders.filter(s => campaign.sliderIds.includes(s.id));
  if (campaign && (campaign.heroTitle || campaign.heroDescription || campaign.heroImage)) {
    const base = sliders[0];
    if (base) sliders = [{ ...base, title: campaign.heroTitle || base.title, subtitle: campaign.heroDescription || base.subtitle, image_url: campaign.heroImage || base.image_url }, ...sliders.slice(1)];
  }
  const activeSlider = sliders[0] || null;

  const homeContent = localize(getStorefrontHomepageContent(), "homepage", ctx.locale);
  const storyData = homeContent?.story;
  const trialsConfig = homeContent?.trials;

  const isTrialsEnabled = trialsConfig?.enabled !== false;
  let featuredTrial = null;
  let allTrials: ReturnType<typeof TrialService.listPublic>["trials"] = [];

  if (isTrialsEnabled) {
    try {
      const publicResult = TrialService.listPublic({ limit: 6 });
      allTrials = publicResult.trials;
      if (trialsConfig?.trial_slug) {
        featuredTrial = TrialService.getPublicBySlug(trialsConfig.trial_slug) || allTrials[0] || null;
      } else {
        featuredTrial = allTrials[0] || null;
      }
    } catch {}
  }

  // Dynamic Content Blocks for Complete MCP Content Management
  const featuredEyebrow = translatedBlock("home.featured_eyebrow", "OUR SIGNATURE BLENDS");
  const featuredTitle = translatedBlock("home.featured_title", "Leaves worth lingering over.");
  const featuredSubtitle = translatedBlock("home.featured_subtitle", "Carefully crafted blends that bring out the extraordinary in every cup.");

  const storyEyebrow = translatedBlock("home.story_eyebrow", storyData?.eyebrow || "WHY TEAFLOWW");
  const storyTitle = translatedBlock(
    "home.story_title",
    storyData?.title
      ? `${storyData.title}${storyData.emphasis ? ` ${storyData.emphasis}` : ""}`
      : "Rooted in tea culture. Guided by curiosity."
  );
  const storyBody = translatedBlock(
    "home.story_body",
    storyData?.description ||
      "Inspired by the gardens and daily tea rituals of Darjeeling, Dooars, the Terai and Bengal, Teafloww shares regional origins, brewing knowledge and thoughtfully developed flavour ideas."
  );
  const storyCtaLabel = translatedBlock(
    "home.story_cta_label",
    storyData?.cta?.label || "Read our story"
  );
  const storyCtaHref = translatedBlock(
    "home.story_cta_href",
    storyData?.cta?.href || "/blog/about-teafloww"
  );
  const storyVideoUrl = translatedBlock(
    "home.story_video_url",
    storyData?.video_url || ""
  );
  const storyVideoTitle = translatedBlock(
    "home.story_video_title",
    storyData?.video_title || "Tea Rituals of North Bengal"
  );
  const storyWordsRaw = translatedBlock("home.story_banner_words", "");
  let storyBannerWords: string[] | undefined;
  if (storyWordsRaw) {
    try {
      const parsed = JSON.parse(storyWordsRaw);
      if (Array.isArray(parsed)) storyBannerWords = parsed;
    } catch {
      storyBannerWords = storyWordsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    }
  }

  const reviewsEyebrow = translatedBlock("home.reviews_eyebrow", "KIND WORDS");
  const reviewsTitle = translatedBlock("home.reviews_title", "Good tea brings good company.");
  const reviewsJson = translatedBlock("home.reviews_json", "");
  let reviewsList;
  if (reviewsJson) {
    try {
      const parsed = JSON.parse(reviewsJson);
      if (Array.isArray(parsed) && parsed.length > 0) reviewsList = parsed;
    } catch {}
  }

  const trustJson = translatedBlock("home.trust_json", "");
  let trustItems;
  if (trustJson) {
    try {
      const parsed = JSON.parse(trustJson);
      if (Array.isArray(parsed) && parsed.length > 0) trustItems = parsed;
    } catch {}
  }

  const newsletterOverline = translatedBlock("home.newsletter_overline", "A QUIETER WAY TO EXPLORE");
  const newsletterHeading = translatedBlock("home.newsletter_heading", "Discover rare teas,\nnew harvests and stories\nfrom the mountains.");
  const newsletterDisclaimer = translatedBlock("home.newsletter_disclaimer", "No spam. Just tea, stories and special offers.");
  const newsletterButton = translatedBlock("home.newsletter_button", "Join the Tea Circle");

  return (
    <div className="tf-homepage-root">
      {/* 1. Hero Banner */}
      <HomeHero
        placement={heroPlacement}
        slider={activeSlider}
        sliders={sliders}
      />

      {/* 2. Circular Category Previews */}
      <CategoryCircles categories={categories} />

      {/* 3. Signature Blends Carousel */}
      <SignatureBlendsCarousel
        products={products}
        eyebrow={featuredEyebrow}
        title={featuredTitle}
        subtitle={featuredSubtitle}
      />

      {/* 3b. Himalayan Tasting Flight (Trials v3 Showcase) */}
      {isTrialsEnabled && featuredTrial && (
        <HomeTrialsSection
          config={trialsConfig}
          featuredTrial={featuredTrial}
          otherTrials={allTrials}
        />
      )}

      {/* 3c. Blend Lab B2B Atelier Discovery */}
      <BlendLabDiscoverySection />

      {/* 4. Bento Grid Story & Origins */}
      <BentoStory
        placement={storyPlacement}
        collageTopPlacement={storyCollageTopPlacement}
        collageBotPlacement={storyCollageBotPlacement}
        scenicImage={storyData?.image_url || storyPlacement?.image_url}
        scenicAlt={storyData?.image_alt || storyPlacement?.alt_text}
        scenicTag={storyData?.scenic_tag || storyPlacement?.subtitle}
        scenicTitle={storyData?.scenic_title || storyPlacement?.title}
        scenicCtaLabel={storyData?.scenic_cta_label || storyPlacement?.cta_label}
        eyebrow={storyEyebrow}
        title={storyTitle}
        body={storyBody}
        ctaLabel={storyCtaLabel}
        ctaHref={storyCtaHref}
        bannerWords={storyData?.banner_words || storyBannerWords}
        collageTopImage={storyData?.collage_top_image_url || storyCollageTopPlacement?.image_url}
        collageTopAlt={storyData?.collage_top_image_alt || storyCollageTopPlacement?.alt_text}
        collageBotImage={storyData?.collage_bottom_image_url || storyCollageBotPlacement?.image_url}
        collageBotAlt={storyData?.collage_bottom_image_alt || storyCollageBotPlacement?.alt_text}
        videoUrl={storyVideoUrl}
        videoTitle={storyVideoTitle}
      />

      {/* 4b. Leaf to Cup Scrollytelling Teaser */}
      <LeafToCupTeaser placement={craftPlacement} />

      {/* 5. Trust / Value Props Bar */}
      <TrustBar items={trustItems} />

      {/* 6. Kind Words / Reviews */}
      <KindWords
        eyebrow={reviewsEyebrow}
        title={reviewsTitle}
        reviews={reviewsList}
      />

      {/* 7. Newsletter Section */}
      <NewsletterSection
        placement={newsletterPlacement}
        overline={newsletterOverline}
        heading={newsletterHeading}
        disclaimer={newsletterDisclaimer}
        buttonLabel={newsletterButton}
      />
    </div>
  );
}
