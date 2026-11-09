# UI Component Inventory

## Implemented
Header: responsive navigation, bag count and accessible menu toggle.
Footer: editorial identity and utility navigation.
ProductCard: illustrative imagery, origin, tasting notes, variant price, cup count and Quick Add.
AddToCart: client cart action with feedback.
VariantPicker: exposed size buttons, price-per-cup and primary CTA.
CartProvider: localStorage persistence and quantity updates.
TasteMap: accessible sensory intensity bars.
TeaPassport: structured product provenance summary, marked illustrative.
TeaFinder: three-step, rule-based recommendation.
CheckoutForm: guest fields, totals, demo API submission.
Global page sections: hero, proof strip, shop by moment, signature products, source story and gifting.

## Planned primitives
Button, IconButton, Chip, Badge, Tabs, Dialog, Drawer, BottomSheet, Accordion, Select, Combobox, Radio, Switch, Toast, Skeleton, Progress, Breadcrumbs, Pagination.

## Planned commerce
CartDrawer, StickyMobileAddToBag, ShippingProgress, DeliveryEstimator, ExpressPaymentBlock, WishlistButton, CompareTray, GiftOptions, BundleBuilder, SubscriptionSelector, ReviewSummary, ProductGallery, BackInStockForm.

## Planned tea-specific
OriginMap, EstateCard, HarvestCalendar, BrewTimer, FlavourArc, FreshnessTimeline, VerifiedLotBadge, TasteComparison and BatchQR.

## Component acceptance rules
All controls need visible focus and keyboard access, proper labels, mobile states, error/empty states and unit or E2E coverage. Never put a fake rating, delivery ETA or certification in a UI component.
