import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import { LocalizedLink as Link } from "@/components/international/InternationalProvider";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return <div className="container page-shell"><div className="empty-state"><p className="eyebrow"> <StorefrontText id="copy_4113f9247a213af5" fallback="404 · A quieter detour" /> </p><h1> <StorefrontText id="copy_e0f5d42a40a755ef" fallback="We could not find that page." /> </h1><p> <StorefrontText id="copy_785ba9249c519ced" fallback="The link may have moved, or the tea you seek lives elsewhere in the collection." /> </p><div className="button-row"><Link href="/shop" className="button button-primary"> <StorefrontText id="copy_41bd09a912e5feb1" fallback="Explore the collection" /> </Link><Link href="/" className="text-link"> <StorefrontText id="copy_3410463f4ad84dc6" fallback="Back to homepage ↗" /> </Link></div></div></div>;
}
