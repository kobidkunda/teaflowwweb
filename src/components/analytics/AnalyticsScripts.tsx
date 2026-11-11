"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
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
    const handleOpenSettings = () => setSettings(true);
    window.addEventListener("open-cookie-settings", handleOpenSettings);
    return () => {
      window.removeEventListener(CONSENT_EVENT, sync);
      window.removeEventListener("open-cookie-settings", handleOpenSettings);
    };
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
      <h2><StorefrontText id="copy_27fed2a49a73923d" fallback="Choose your cookies" /></h2>
      <p><StorefrontText id="copy_c919c4b974125043" fallback="Essential cookies keep your bag and checkout working. Optional analytics help us improve TeaFloww; marketing cookies help Google and Meta show relevant ads." /> <a href="/privacy"><StorefrontText id="copy_ba445cff3898a3f2" fallback="Privacy policy" /></a></p>
      <div className="tracking-consent-actions">
        <button type="button" className="button button-outline" onClick={() => choose(DENIED_CONSENT)}><StorefrontText id="copy_99468ef7474b8794" fallback="Essential only" /></button>
        <button type="button" className="button button-outline" onClick={() => choose({ analytics: true, marketing: false })}><StorefrontText id="copy_ab9e3e3f6b320ffa" fallback="Analytics only" /></button>
        <button type="button" className="button button-primary" onClick={() => choose({ analytics: true, marketing: true })}><StorefrontText id="copy_f55ee86234087579" fallback="Accept all" /></button>
        {settings && <button type="button" className="button button-outline" onClick={() => setSettings(false)}><StorefrontText id="copy_7d9eb7acb13e2462" fallback="Close" /></button>}
      </div>
    </section> : null}
  </>;
}

/** Without JavaScript there is no verified optional-cookie consent; do not bypass it with pixels. */
export function AnalyticsBodyNoScript() { return null; }
