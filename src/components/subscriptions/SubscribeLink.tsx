'use client';
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { subscriptionRequest } from './shared';
export function SubscribeLink({ variantId, trialId, quantity = 1, bag = false }: { trialId?: string; variantId?: number; quantity?: number; bag?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { let active = true; subscriptionRequest('policy').then(r => { if (active) setEnabled(r.policy.enabled); }).catch(() => {}); return () => { active = false; }; }, []);
  if (!enabled) return null;
  return <div style={{ margin: '16px 0' }}><Link className="button button-outline" href={bag ? '/subscribe' : `/subscribe?${trialId ? `trial=${trialId}` : `variant=${variantId}`}&quantity=${quantity}`}><StorefrontText id="copy_cc0e38da9c41790b" fallback="Subscribe" /> {bag ? 'to this bag' : 'to this tea'} →</Link><p className="micro-note"><StorefrontText id="copy_a9ed77273b5bd9b3" fallback="Every 3, 7, 14, 30 or 60 days. Review savings and delivery fees." /></p></div>;
}
