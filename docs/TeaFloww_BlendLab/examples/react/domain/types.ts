export type PlanCode = 'MATCH_QUOTE' | 'QUALITY_AUDIT' | 'SIGNATURE';

export interface PlanEntitlements {
  inboundShipments: number;
  outboundShipments: number;
  detailedPdf: boolean;
  developmentIncluded: boolean;
  includedRevisionRounds: number | null; // null = not commercially approved, NOT unlimited
  includedTrialCandidates: number | null;
}
export interface ServicePlan {
  code: PlanCode;
  title: string;
  eyebrow: string;
  description: string;
  totalPaise: number; // integer INR paise, a DESIGN-ONLY price until billing approval
  highlighted?: boolean;
  features: readonly string[];
  exclusions: readonly string[];
  buttonLabel: string;
  entitlements: PlanEntitlements;
}
export type ProjectStage =
  | 'draft' | 'awaiting_payment' | 'paid' | 'awaiting_sample'
  | 'intake_pending' | 'sample_exception' | 'tasting_queued'
  | 'tasting_in_progress' | 'report_draft' | 'report_ready'
  | 'trial_dispatch_pending' | 'trial_in_transit' | 'feedback_pending'
  | 'revision_in_progress' | 'formula_approved'
  | 'quote_draft' | 'quote_ready' | 'wholesale_order_pending' | 'completed'
  | 'courier_exception' | 'paused' | 'cancelled';
export type FindingSource =
  | 'human_sensory' | 'instrument' | 'external_lab' | 'supplier_claim'
  | 'customer_supplied' | 'commercial_estimate' | 'ai_prediction';
export interface EvidenceFinding {
  label: string;
  value: string | number | null;
  unit?: string;
  methodId?: string;
  observedAt?: string;
  source: FindingSource;
  reviewerId?: string;
}
