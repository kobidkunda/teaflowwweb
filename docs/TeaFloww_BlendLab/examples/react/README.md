# React / TypeScript Design Code Examples — Not an App

These snippets demonstrate reusable component contracts and domain patterns. They intentionally contain **no runnable app bootstrap, no page router, no installed dependencies, no real payment/courier calls, no data persistence and no login**.

Use the examples **only after** confirming the real TeaFloww frontend stack and adapting paths/framework/library choices.

## Files
- `styles/tokens.css`: single palette, typography, layout and components styles (scoped `tl-*`).
- `domain/plans.ts`: one source of truth for proposed tier names/entitlements; plan costs are in paise, subject to finance approval.
- `domain/money.ts`: deterministic inclusive-GST helper, demonstrates separating tax configuration from UI.
- `domain/state-machine.ts`: pure guards, not persistence or concurrency control.
- `domain/types.ts`: typed product/status contracts.
- `components/Button.tsx`: reusable button/link.
- `components/SectionHeading.tsx`: heading primitive.
- `components/PlanCard.tsx`: consistent tier presentation.
- `components/BlendLabHero.tsx`: homepage/landing hero variant.
- `components/ProcessSteps.tsx`: accessible workflow illustration.
- `components/ReportTeaser.tsx`: explicitly synthetic report teaser.
- `components/GoalsSelector.tsx`: controlled input example.
- `snippets/BlendLabLandingExample.tsx`: how to compose parts; **no page route**.
- `snippets/CheckoutServerPseudo.ts`: nonfunctional server example annotated with security requirements.

All prices/entitlements should eventually come from the verified server catalog. The local plan definitions are a temporary design and typing reference only. Use actual approved business rules before checkout.
