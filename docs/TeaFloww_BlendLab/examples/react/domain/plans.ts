import type { PlanCode, ServicePlan } from './types';

/** Presentation-only seed. The server must return FINANCE-APPROVED versions. */
export const planCatalog: Readonly<Record<PlanCode, ServicePlan>> = {
  MATCH_QUOTE: {
    code: 'MATCH_QUOTE', title: 'Match & Quote', eyebrow: 'START WITH A REFERENCE',
    description: 'Compare your existing tea with possible wholesale sourcing alternatives.',
    totalPaise: 29900, buttonLabel: 'Match my tea',
    features: ['One inbound sample courier*', 'Professional reference review', 'Bulk sourcing price proposal', 'Concise matching notes'],
    exclusions: ['No detailed PDF report', 'No physical trial samples'],
    entitlements: { inboundShipments: 1, outboundShipments: 0, detailedPdf: false,
      developmentIncluded: false, includedRevisionRounds: 0, includedTrialCandidates: 0 },
  },
  QUALITY_AUDIT: {
    code: 'QUALITY_AUDIT', title: 'Tea Quality Audit', eyebrow: 'UNDERSTAND YOUR CUP',
    description: 'Detailed professional sensory analysis and a structured, actionable report.',
    totalPaise: 199900, buttonLabel: 'Analyse my tea',
    features: ['One inbound sample courier*', 'Controlled professional tasting', 'Detailed PDF report', 'Sensory & improvement insights'],
    exclusions: ['No custom physical blend samples'],
    entitlements: { inboundShipments: 1, outboundShipments: 0, detailedPdf: true,
      developmentIncluded: false, includedRevisionRounds: 0, includedTrialCandidates: 0 },
  },
  SIGNATURE: {
    code: 'SIGNATURE', title: 'Signature Blend Lab', eyebrow: 'COMPLETE BLEND DEVELOPMENT',
    description: 'Professional evaluation, blend-development trials and a customer feedback pathway.',
    totalPaise: 299900, highlighted: true, buttonLabel: 'Develop my blend',
    features: ['Inbound + outbound courier*', 'Detailed professional PDF', 'Candidate blend development*', 'Physical trial samples*', 'Defined feedback and revision*', 'Wholesale quotation'],
    exclusions: ['Bulk tea purchases priced separately'],
    entitlements: { inboundShipments: 1, outboundShipments: 1, detailedPdf: true,
      developmentIncluded: true, includedRevisionRounds: null, includedTrialCandidates: null },
  },
} as const;

export const orderedPlans: readonly ServicePlan[] = [
  planCatalog.MATCH_QUOTE, planCatalog.QUALITY_AUDIT, planCatalog.SIGNATURE,
];

export function displayPlan(code: PlanCode): ServicePlan { return planCatalog[code]; }
// * Actual courier coverage/weights, included candidates/revisions and tax classification
//   require operational validation before paid launch. null NEVER means unlimited.
