import React from "react";
import type { Metadata } from "next";
import { constructMetadata } from "@/lib/seo/metadata";
import { PrivateLabelService } from "@/lib/private-label/service";
import {
  toPublicTeaOptionDto,
  toPublicPrintMethodDto,
} from "@/lib/private-label/public-dto";
import { StudioConfigurator } from "@/components/private-label/StudioConfigurator";

export const metadata: Metadata = constructMetadata({
  title: "Private Label Studio Configurator — Bespoke Tea & Packaging | TeaFloww",
  description:
    "Design and quote custom branded private label tea projects in real time. Choose from Himalayan single-estate teas, barrier pouches, metal tins, and direct print finishes.",
  path: "/private-label/studio",
  ogImage: "/images/private-label/atelier-concept.webp",
});

export default async function StudioPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const resolvedParams = searchParams ? await searchParams : {};
  const packageSlug =
    typeof resolvedParams.package === "string"
      ? resolvedParams.package
      : typeof resolvedParams.pack === "string"
      ? resolvedParams.pack
      : null;

  // Only whitelisted public catalogue data may cross the server/client boundary.
  const teaRes = PrivateLabelService.listTeaOptions({ is_published: true });
  const teas = teaRes.items.map(toPublicTeaOptionDto);
  const packagingVariants = PrivateLabelService.listPublicPackagingVariants({ limit: 100 }).items;
  const printMethods = PrivateLabelService.listPrintMethods().map(toPublicPrintMethodDto);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#FFFCF7" }}>
      <StudioConfigurator
        teas={teas}
        packagingVariants={packagingVariants}
        printMethods={printMethods}
        initialPackageSlug={packageSlug}
      />
    </div>
  );
}
