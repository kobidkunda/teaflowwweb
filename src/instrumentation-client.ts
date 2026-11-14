import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn:
    process.env.NEXT_PUBLIC_SENTRY_DSN ||
    "https://ebf0f7d26128d1a859e07a90d3aa4b59@o4512431816114176.ingest.de.sentry.io/4512431876669520",
  integrations: [
    // enables Session Replay
    Sentry.replayIntegration(),
    // enables User Feedback
    Sentry.feedbackIntegration({
      colorScheme: "system",
    }),
  ],

  // Enables Tracing: 100% in development for verification, 10% in production.
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

  // Capture replays for 10% of all sessions,
  // plus for 100% of sessions with an error
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Instruments client-side navigations
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
