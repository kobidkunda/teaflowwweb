import type { ProjectStage } from './types';

/** Illustrative pure guard, not a DB transaction or full production state machine.
 * Enforce these on the SERVER with payment/entitlement/role checks and audit events.
 */
const allowed: Partial<Record<ProjectStage, readonly ProjectStage[]>> = {
  draft: ['awaiting_payment', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['awaiting_sample', 'courier_exception', 'cancelled'],
  awaiting_sample: ['intake_pending', 'courier_exception'],
  intake_pending: ['tasting_queued', 'sample_exception'],
  sample_exception: ['intake_pending', 'cancelled'],
  tasting_queued: ['tasting_in_progress'],
  tasting_in_progress: ['report_draft', 'quote_draft'],
  report_draft: ['report_ready'],
  report_ready: ['trial_dispatch_pending', 'quote_draft', 'completed'],
  trial_dispatch_pending: ['trial_in_transit', 'courier_exception'],
  trial_in_transit: ['feedback_pending', 'courier_exception'],
  feedback_pending: ['revision_in_progress', 'formula_approved'],
  revision_in_progress: ['trial_dispatch_pending', 'feedback_pending'],
  formula_approved: ['quote_draft', 'quote_ready'],
  quote_draft: ['quote_ready'],
  quote_ready: ['wholesale_order_pending', 'completed'],
  wholesale_order_pending: ['completed'],
  courier_exception: ['awaiting_sample', 'trial_dispatch_pending', 'cancelled'],
  paused: ['awaiting_sample', 'tasting_queued', 'cancelled'],
};
export const mayTransition = (from: ProjectStage, to: ProjectStage): boolean =>
  Boolean(allowed[from]?.includes(to));
