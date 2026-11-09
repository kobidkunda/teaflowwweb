"use client";
import { Text as StorefrontText } from "@/components/international/InternationalProvider";
export default function Error({ reset }: { reset: () => void }) { return <div className="ritual-container ritual-empty" role="alert"><h2> <StorefrontText id="copy_32a444239e8c4cd5" fallback="The collection could not be loaded." /> </h2><p> <StorefrontText id="copy_7ba353b04a5b3c44" fallback="Please try again in a moment." /> </p><button type="button" className="button button-primary" onClick={reset}> <StorefrontText id="copy_d8b8392e2c542950" fallback="Try again" /> </button></div>; }
