import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React from "react";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPageBySlug } from "@/lib/pages";
import { constructMetadata } from "@/lib/seo/metadata";
import { getBreadcrumbSchema } from "@/lib/seo/schema";
import { getDynamicSiteConfig } from "@/lib/seo/site";
import { requestContext } from "@/lib/international/context";
import { localize } from "@/lib/international/translations";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requestContext();
  const rawPage = getPageBySlug(slug);
  if (!rawPage || !rawPage.is_published) {
    return { title: "Page Not Found" };
  }
  const resource = `page:${rawPage.id}`;
  const page = localize(rawPage, resource, ctx.locale);
  const siteConfig = getDynamicSiteConfig();
  return constructMetadata({
    title: page.meta_title || `${page.title} · ${siteConfig.name}`,
    description: page.meta_description || page.subtitle || `Read ${page.title} at ${siteConfig.name}`,
    path: `/pages/${page.slug}`,
    locale: ctx.requestedLocale || ctx.locale,
    resource,
  });
}

export default async function CustomDynamicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requestContext();
  const rawPage = getPageBySlug(slug);

  if (!rawPage || !rawPage.is_published) {
    notFound();
  }

  const page = localize(rawPage, `page:${rawPage.id}`, ctx.locale);

  const siteConfig = getDynamicSiteConfig();
  const breadcrumbJsonLd = getBreadcrumbSchema([
    { name: "Home", url: "/" },
    { name: page.title, url: `/pages/${page.slug}` },
  ]);

  return (
    <div className="container page-shell max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      <nav className="breadcrumbs flex items-center gap-1.5 text-xs text-[#63685e] mb-8" aria-label="Breadcrumb">
        <Link href="/" className="hover:text-[#18231c] transition-colors"> <StorefrontText id="copy_3a78695388b38b5c" fallback="Home" /> </Link>
        <span className="text-[#a59f92]">/</span>
        <span aria-current="page" className="text-[#18231c] font-semibold">
          {page.title}
        </span>
      </nav>

      <header className="mb-12 pb-8 border-b border-[#e4ded0]">
        {page.eyebrow && (
          <span className="text-xs font-bold uppercase tracking-widest text-[#2c4e38] block mb-2">
            {page.eyebrow}
          </span>
        )}
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl text-[#18231c] leading-tight mb-4">
          {page.headline || page.title}
        </h1>
        {page.subtitle && (
          <p className="text-lg sm:text-xl text-[#52594e] font-serif italic leading-relaxed">
            {page.subtitle}
          </p>
        )}
      </header>

      {page.hero_image_url && (
        <div className="mb-10 overflow-hidden rounded-xl border border-[#e4ded0] relative aspect-[16/9] w-full">
          <Image
            src={page.hero_image_url}
            alt={page.headline || page.title}
            fill
            className="object-cover"
            sizes="(max-width: 768px) 100vw, 896px"
          />
        </div>
      )}

      <div className="space-y-8 text-[#3d433b] text-base sm:text-lg leading-relaxed">
        {page.body_markdown && (
          <div className="whitespace-pre-line text-[#3d433b]">{page.body_markdown}</div>
        )}

        {page.sections && page.sections.length > 0 && (
          <div className="space-y-6">
            {page.sections.map((sec, idx) => (
              <section key={sec.id || idx} className="p-6 bg-[#f7f5f0] border border-[#ece7dc] rounded-xl">
                {sec.heading && (
                  <h2 className="font-serif text-xl font-bold text-[#18231c] mb-2">{sec.heading}</h2>
                )}
                {sec.body && <p className="text-sm sm:text-base text-[#52594e]">{sec.body}</p>}
                {Array.isArray(sec.items) && sec.items.length > 0 && (
                  <ul className="list-disc pl-6 space-y-1.5 text-[#4a5047] mt-3 text-sm">
                    {sec.items.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                )}
                {sec.cta_label && sec.cta_url && (
                  <div className="mt-4">
                    <Link
                      href={sec.cta_url}
                      className="text-xs font-bold text-[#2c4e38] hover:underline"
                    >
                      {sec.cta_label} →
                    </Link>
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="mt-12 pt-8 border-t border-[#e4ded0] flex justify-between items-center">
        <Link href="/contact" className="text-sm font-semibold text-[#18231c] hover:text-[#2c4e38]"> <StorefrontText id="copy_2b5c3d26721ae9c3" fallback="Contact" /> {siteConfig.brand} <StorefrontText id="copy_a4f563d07655a30c" fallback="Tasting Room →" /> </Link>
        <Link href="/shop" className="px-6 py-2.5 bg-[#18231c] text-[#fbf9f4] text-xs font-bold uppercase tracking-wider rounded-md hover:bg-[#2c4e38] transition-colors"> <StorefrontText id="copy_61c2479a3e7c0ea8" fallback="Shop Our Teas" /> </Link>
      </div>
    </div>
  );
}
