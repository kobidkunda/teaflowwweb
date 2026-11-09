import { TeaFinder } from "@/components/TeaFinder";
import { getPageOrDefault } from "@/lib/pages";
import { constructMetadata } from "@/lib/seo/metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const page = getPageOrDefault("tea-finder");
  return constructMetadata({
    title: page.meta_title || "Tea Sommelier Finder — Personalized Recommendations",
    description: page.meta_description || "Find your ideal loose-leaf tea based on your taste preferences and brewing style.",
    path: "/tea-finder",
    ogImage: "/images/bento-blossom.jpg",
  });
}

export default function TeaFinderPage() {
  const page = getPageOrDefault("tea-finder");
  const eyebrow = page.eyebrow || "A personal discovery";
  const headline = page.headline || "Find your tea.";
  const subtitle = page.subtitle || "No expertise required. Follow your senses.";

  return (
    <div className="container page-shell finder-page">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{headline}</h1>
      <p className="page-intro">{subtitle}</p>
      <TeaFinder />
    </div>
  );
}
