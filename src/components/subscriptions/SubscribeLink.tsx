'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { subscriptionRequest } from './shared';
export function SubscribeLink({ variantId, trialId, quantity = 1, bag = false }: { trialId?: string; variantId?: number; quantity?: number; bag?: boolean }) {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { let active = true; subscriptionRequest('policy').then(r => { if (active) setEnabled(r.policy.enabled); }).catch(() => {}); return () => { active = false; }; }, []);
  if (!enabled) return null;
  return <div style={{ margin: '16px 0' }}><Link className="button button-outline" href={bag ? '/subscribe' : `/subscribe?${trialId ? `trial=${trialId}` : `variant=${variantId}`}&quantity=${quantity}`}>Subscribe {bag ? 'to this bag' : 'to this tea'} →</Link><p className="micro-note">Every 3, 7, 14, 30 or 60 days. Review savings and delivery fees.</p></div>;
}
