"use client";

import React from "react";
import { FlaskConical, ArrowRight } from "lucide-react";
import type { HomepageContent } from "./types";
import { ImageFieldWithPicker } from "./ImageFieldWithPicker";
import { HOME_TRIAL_MEDIA_GUIDANCE, homeTrialsPresentation } from "@/lib/homeTrialsPresentation";

interface TrialsTabProps {
  content: HomepageContent;
  onChange: (updater: (prev: HomepageContent) => HomepageContent) => void;
}

export function TrialsTab({ content, onChange }: TrialsTabProps) {
  const trials = homeTrialsPresentation(content.trials);
  const update = (partial: Partial<NonNullable<HomepageContent["trials"]>>) => {
    onChange((prev) => ({ ...prev, trials: { ...homeTrialsPresentation(prev.trials), ...partial } }));
  };
  const fieldClass = "w-full min-h-[44px] border border-[#b8b5a8] rounded-md px-3 py-2 bg-[#fffefa] text-sm";
  return (
    <div className="hp-tab-pane space-y-6">
      <div className="hp-tab-header">
        <h2 className="flex items-center gap-2 text-lg font-serif text-[#171713]"><FlaskConical size={20} />Sample kit invitation</h2>
        <p className="text-sm text-[#526359]">A photographic homepage introduction that takes customers to the trial kit collection.</p>
      </div>
      <label className="flex items-center gap-3 min-h-[44px] text-sm font-semibold">
        <input id="trials-enable-toggle" type="checkbox" checked={trials.enabled} onChange={(e) => update({ enabled: e.target.checked })} />
        Display sample kit section
      </label>
      <p className="text-xs text-[#526359]">The section is hidden when disabled or when no trial kits are published.</p>
      <fieldset className="space-y-5" disabled={!trials.enabled}>
        <legend className="text-base font-semibold mb-4">Copy and destination</legend>
        <label className="block text-sm">Eyebrow<input className={fieldClass} value={trials.eyebrow} onChange={(e) => update({ eyebrow: e.target.value })} /></label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="block text-sm">Heading opening<input className={fieldClass} value={trials.title} onChange={(e) => update({ title: e.target.value })} /></label>
          <label className="block text-sm">Italic emphasis<input className={fieldClass} value={trials.emphasis} onChange={(e) => update({ emphasis: e.target.value })} /></label>
          <label className="block text-sm">Heading ending<input className={fieldClass} value={trials.title_suffix} onChange={(e) => update({ title_suffix: e.target.value })} /></label>
        </div>
        <label className="block text-sm">Introduction<textarea rows={3} className={fieldClass} value={trials.description} onChange={(e) => update({ description: e.target.value })} /></label>
        <label className="block text-sm">Button label<input className={fieldClass} value={trials.cta.label} onChange={(e) => update({ cta: { label: e.target.value, href: "/trials" } })} /></label>
        <p className="text-xs text-[#526359]">Button destination: <a href="/trials" target="_blank" rel="noreferrer" className="underline">/trials</a>. This section always opens the sample-kit collection.</p>
        <label className="block text-sm">Text below button<input className={fieldClass} value={trials.supporting_text} onChange={(e) => update({ supporting_text: e.target.value })} /></label>
      </fieldset>
      <fieldset className="space-y-6" disabled={!trials.enabled}>
        <legend className="text-base font-semibold mb-4">Background artwork</legend>
        <p className="text-sm text-[#526359]">Upload image-only artwork. Headings and buttons remain accessible page text. Keep all cups and pouches within the frame; preview uses a centered cover crop.</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ImageFieldWithPicker id="trials-desktop-image" label="Desktop background — 1920 × 720 px"
            description="Exact recommended size: 1920 × 720 px (8:3). Shown above 640px viewport width."
            imageUrl={trials.image_url} imageAlt={trials.image_alt}
            onImageUrlChange={(url) => update({ image_url: url })} onImageAltChange={(alt) => update({ image_alt: alt })}
            previewAspectRatio="8 / 3" aspectRatioHint="8:3 · 1920 × 720 px" recommendation="WebP or JPEG, preferably under 400 KB; max upload 5 MB" disabled={!trials.enabled} />
          <ImageFieldWithPicker id="trials-mobile-image" label="Mobile background — 960 × 1080 px"
            description="Exact recommended size: 960 × 1080 px (8:9). Shown at 640px and below. Arrange four cup/pouch pairs in 2 × 2; avoid cropping the desktop strip."
            imageUrl={trials.mobile_image_url} imageAlt={trials.image_alt}
            onImageUrlChange={(url) => update({ mobile_image_url: url })} onImageAltChange={(alt) => update({ image_alt: alt })}
            previewAspectRatio="8 / 9" aspectRatioHint="8:9 · 960 × 1080 px" recommendation="WebP or JPEG, preferably under 400 KB; max upload 5 MB" disabled={!trials.enabled} />
        </div>
        <p className="text-xs text-[#526359]">{HOME_TRIAL_MEDIA_GUIDANCE.behavior}</p>
        <label className="block text-sm">Visible image caption<input className={fieldClass} value={trials.image_caption} onChange={(e) => update({ image_caption: e.target.value })} /><span className="text-xs text-[#526359]">Keep “Illustrative imagery” for generated artwork. Use an accurate caption for approved photographs.</span></label>
        <div className="rounded-md border border-[#d6cebf] p-4 text-sm text-[#526359]">
          <strong className="block mb-2">MCP image editing</strong>
          <p>Read with store.getHomepageContent, then save the complete content using admin.updateHomepageContent. Edit trials.image_url, trials.mobile_image_url, trials.image_alt and trials.image_caption. Both tools return media_guidance with these exact dimensions.</p>
        </div>
      </fieldset>
      <div className="p-4 border-t border-[#d6cebf] text-[#23483a] text-sm flex items-center gap-2">
        {trials.cta.label}<ArrowRight size={16} aria-hidden="true" /><span>/trials</span>
      </div>
    </div>
  );
}
