/**
 * Private Label WhatsApp Utilities
 *
 * Safe for use in both Server Components and Client Components (no "use client" directive).
 */

/**
 * Normalizes phone numbers into clean digits with country code for wa.me links.
 * Automatically adds India 91 prefix for 10-digit mobile numbers.
 */
export function formatWhatsAppDigits(raw?: string): string {
  if (!raw) return "917001304853";
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "917001304853";
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

/**
 * Formats phone number for clean human presentation.
 */
export function formatWhatsAppDisplay(raw?: string): string {
  if (!raw) return "+91 70013 04853";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  if (digits.length === 12 && digits.startsWith("91")) {
    return `+91 ${digits.slice(2, 7)} ${digits.slice(7)}`;
  }
  return raw.trim();
}

/**
 * Generates context-aware assistance message based on current private-label pathname.
 */
export function buildPrivateLabelWhatsAppMessage(params: {
  pathname: string;
  topic?: string;
  customNote?: string;
}): string {
  const { pathname, topic, customNote } = params;

  let sectionContext = "Private Label Tea Services";
  let promptOpening = "Hello TeaFloww! I'm exploring your Private Label tea services and would like guidance.";

  if (pathname.includes("/studio")) {
    sectionContext = "Studio Configurator";
    promptOpening = "Hello TeaFloww! I'm in the Private Label Studio designing a custom blend and need assistance.";
  } else if (pathname.includes("/packaging")) {
    sectionContext = "Packaging Catalogue";
    promptOpening = "Hello TeaFloww! I'm browsing your Packaging Catalogue and have a question about materials & MOQs.";
  } else if (pathname.includes("/quotes")) {
    sectionContext = "Quotation Review";
    promptOpening = "Hello TeaFloww! I have a question regarding my Private Label Quotation.";
  } else if (pathname.includes("/samples")) {
    sectionContext = "Tasting Sample Kits";
    promptOpening = "Hello TeaFloww! I'd like to ask about Private Label Tasting Sample Kits.";
  } else if (pathname.includes("/orders")) {
    sectionContext = "Orders & Production";
    promptOpening = "Hello TeaFloww! I'm inquiring about a Private Label production run.";
  }

  const lines = [promptOpening];

  if (topic) {
    lines.push(`\nTopic: ${topic}`);
  }

  if (customNote && customNote.trim()) {
    lines.push(`\nNote: ${customNote.trim()}`);
  }

  lines.push(`\nRef Section: ${sectionContext}`);
  lines.push(`URL: https://teafloww.com${pathname || "/private-label"}`);

  return lines.join("\n");
}

export const QUICK_HELP_TOPICS = [
  { label: "MOQs & Volume Pricing", query: "What are the minimum order quantities (MOQ) and tiered unit costs for this option?" },
  { label: "Packaging Specs & Dielines", query: "Can you provide the prepress dieline and confirm print compatibility?" },
  { label: "Custom Blend Matching", query: "Can you help match or recommend a specific single-estate orthodox / CTC recipe?" },
  { label: "Sample Kit Request", query: "How do I order a tasting sample kit to evaluate quality before a production run?" },
  { label: "Production Turnaround", query: "What is the typical production and dispatch turnaround time for customized packaging?" },
];
