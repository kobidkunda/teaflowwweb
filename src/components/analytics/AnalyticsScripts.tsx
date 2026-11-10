"use client";

import React, { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import type { PublicTrackingConfig } from "@/lib/trackingSettings";
import { CONSENT_EVENT, CONSENT_KEY, gtmLoaderScript, DENIED_CONSENT, readTrackingConsent, trackingRouteAllowed, updateTrackingConsent, type TrackingConsent } from "@/lib/seo/consent";
import { ensureMetaQueue, trackPageView } from "@/lib/seo/tracking";

export function AnalyticsHeadScripts({ config }: { config: PublicTrackingConfig }) {
  const pathname = usePathname();
  const [consent, setConsent] = useState<TrackingConsent>(DENIED_CONSENT);
  const [chosen, setChosen] = useState(true);
  const [settings, setSettings] = useState(false);
  const lastPage = useRef({ path: "", analytics: false, marketing: false });
  useEffect(() => {
    const sync = () => {
      setConsent(readTrackingConsent());
      try { const saved = JSON.parse(localStorage.getItem(CONSENT_KEY) || "null"); setChosen(saved?.version === 1 && typeof saved.analytics === "boolean" && typeof saved.marketing === "boolean"); } catch { setChosen(false); }
    };
    sync();
    window.addEventListener(CONSENT_EVENT, sync);
    return () => window.removeEventListener(CONSENT_EVENT, sync);
  }, []);

  useEffect(() => {
    if (!pathname || !trackingRouteAllowed(pathname)) return;
    // Set sanitized Google defaults before rendering/loading the vendor scripts below.
    ensureMetaQueue();
    const current = readTrackingConsent();
    const previous = lastPage.current;
    const google = current.analytics && (previous.path !== pathname || !previous.analytics);
    const meta = current.marketing && (previous.path !== pathname || !previous.marketing);
    if (google || meta) trackPageView(undefined, undefined, { google, meta });
    lastPage.current = { path: pathname, ...current };
  }, [pathname, consent.analytics, consent.marketing]);

  const choose = (next: TrackingConsent) => {
    updateTrackingConsent(next); setConsent(next); setChosen(true); setSettings(false);
  };
  if (!pathname || !trackingRouteAllowed(pathname)) return null;
  const googleAllowed = consent.analytics || consent.marketing;
  const gtm = config.gtmEnabled && /^GTM-[A-Z0-9]+$/.test(config.gtmContainerId);
  const ga4 = config.ga4Enabled && /^G-[A-Z0-9]+$/.test(config.ga4MeasurementId);
  const meta = config.metaPixelEnabled && /^\d+$/.test(config.metaPixelId);
  return <>
    {googleAllowed && gtm && <Script id="google-tag-manager" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: gtmLoaderScript(config.gtmContainerId) }} />}
    {consent.analytics && !gtm && ga4 && <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4MeasurementId}`} strategy="afterInteractive" />
    </>}
    {consent.marketing && !gtm && meta && <Script src="https://connect.facebook.net/en_US/fbevents.js" strategy="afterInteractive" />}
    {consent.marketing && !gtm && config.customHeadScript && <Script id="custom-head-tracking" strategy="afterInteractive" dangerouslySetInnerHTML={{ __html: config.customHeadScript }} />}
    {consent.marketing && !gtm && config.customBodyScript && <div id="custom-body-tracking" dangerouslySetInnerHTML={{ __html: config.customBodyScript }} />}
    {(!chosen || settings) ? <section aria-label="Cookie preferences" className="tracking-consent-panel">
      <h2>Choose your cookies</h2>
      <p>Essential cookies keep your bag and checkout working. Optional analytics help us improve TeaFloww; marketing cookies help Google and Meta show relevant ads. <a href="/privacy">Privacy policy</a></p>
      <div className="tracking-consent-actions">
        <button type="button" className="button button-outline" onClick={() => choose(DENIED_CONSENT)}>Essential only</button>
        <button type="button" className="button button-outline" onClick={() => choose({ analytics: true, marketing: false })}>Analytics only</button>
        <button type="button" className="button button-primary" onClick={() => choose({ analytics: true, marketing: true })}>Accept all</button>
      </div>
    </section> : <button type="button" className="tracking-cookie-settings" onClick={() => setSettings(true)}>Cookie settings</button>}
  </>;
}

/** Without JavaScript there is no verified optional-cookie consent; do not bypass it with pixels. */
export function AnalyticsBodyNoScript() { return null; }
