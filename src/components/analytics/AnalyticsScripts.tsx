import React from "react";
import Script from "next/script";
import type { PublicTrackingConfig } from "@/lib/trackingSettings";

export function AnalyticsHeadScripts({ config }: { config: PublicTrackingConfig }) {
  const {
    gtmContainerId,
    gtmEnabled,
    ga4MeasurementId,
    ga4Enabled,
    metaPixelId,
    metaPixelEnabled,
    customHeadScript,
  } = config;

  return (
    <>
      {/* Next schedules lazyOnload after load and idle. Preserve queued events. */}
      {gtmEnabled && gtmContainerId ? (
        <Script
          id="google-tag-manager"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer=window.dataLayer||[];
(function(){
    if(window.__gtm_loaded) return;
    window.__gtm_loaded = true;
    (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
    new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
    j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
    'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
    })(window,document,'script','dataLayer','${gtmContainerId}');
})();`,
          }}
        />
      ) : null}

      {/* GTM owns Google tags when active; direct GA4 is the standalone fallback. */}
      {ga4Enabled && ga4MeasurementId && !(gtmEnabled && gtmContainerId) ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4MeasurementId)}`}
            strategy="lazyOnload"
          />
          <Script
            id="google-analytics-gtag"
            strategy="lazyOnload"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${ga4MeasurementId}', { send_page_view: false });`,
            }}
          />
        </>
      ) : null}

      {/* 3. Meta / Facebook Pixel if enabled */}
      {metaPixelEnabled && metaPixelId ? (
        <Script
          id="meta-pixel"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${metaPixelId}');
fbq('track', 'PageView');`,
          }}
        />
      ) : null}

      {/* 4. Custom Head Script (if configured) */}
      {customHeadScript ? (
        <Script
          id="custom-head-tracking"
          strategy="lazyOnload"
          dangerouslySetInnerHTML={{ __html: customHeadScript }}
        />
      ) : null}
    </>
  );
}

export function AnalyticsBodyNoScript({ config }: { config: PublicTrackingConfig }) {
  const { gtmContainerId, gtmEnabled, metaPixelId, metaPixelEnabled, customBodyScript } = config;

  return (
    <>
      {/* 1. Google Tag Manager (noscript) */}
      {gtmEnabled && gtmContainerId ? (
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${encodeURIComponent(gtmContainerId)}`}
            height="0"
            width="0"
            style={{ display: "none", visibility: "hidden" }}
          />
        </noscript>
      ) : null}

      {/* 2. Meta Pixel (noscript) */}
      {metaPixelEnabled && metaPixelId ? (
        <noscript>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            height="1"
            width="1"
            style={{ display: "none" }}
            src={`https://www.facebook.com/tr?id=${encodeURIComponent(metaPixelId)}&ev=PageView&noscript=1`}
            alt=""
          />
        </noscript>
      ) : null}

      {/* 3. Custom Body Script (if configured) */}
      {customBodyScript ? (
        <div
          id="custom-body-tracking"
          dangerouslySetInnerHTML={{ __html: customBodyScript }}
        />
      ) : null}
    </>
  );
}
