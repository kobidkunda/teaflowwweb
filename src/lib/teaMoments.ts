import { z } from "zod";

const imagePath = z.string().trim().max(500).refine(
  (value) => !value || (/^\/(?!\/)/.test(value) && !/[\\\s\u0000-\u001f]/.test(value) && !value.includes("..")),
  "Choose an uploaded image or a site-relative image path."
);

export const teaMomentsSchema = z.object({
  headline: z.string().trim().max(120).default("Make it your moment."),
  introduction: z.string().trim().max(1200).default(""),
  occasion: z.string().trim().max(300).default(""),
  serving_suggestion: z.string().trim().max(300).default(""),
  food_pairing: z.string().trim().max(300).default(""),
  image_url: imagePath.default(""),
  image_alt: z.string().trim().max(300).default(""),
}).strict().refine((value) => !value.image_url || !!value.image_alt, {
  message: "Describe the Tea Moments image for accessibility.", path: ["image_alt"],
});
export type TeaMomentsContent = z.infer<typeof teaMomentsSchema>;

export function parseTeaMoments(value: unknown): TeaMomentsContent | null {
  try {
    const result = teaMomentsSchema.safeParse(typeof value === "string" ? JSON.parse(value) : value);
    return result.success ? result.data : null;
  } catch { return null; }
}
