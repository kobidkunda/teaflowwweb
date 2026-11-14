import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn:
    process.env.SENTRY_DSN ||
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    "https://ebf0f7d26128d1a859e07a90d3aa4b59@o4512431816114176.ingest.de.sentry.io/4512431876669520",

  // Enables Tracing: 100% in development for verification, 10% in production.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
});
