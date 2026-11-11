"use client";

import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import Link from "next/link";
import styles from "@/components/trials/TrialsCollection.module.css";

export default function TrialsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className={`${styles.page} ${styles.error}`} aria-labelledby="trials-error-title">
      <h1 id="trials-error-title"><StorefrontText id="copy_c11140bfd0076204" fallback="The discovery shelf is taking a moment." /></h1>
      <p><StorefrontText id="copy_4d1cad4da84f4dc7" fallback="We couldn’t load the kits. Please try again, or explore the tea shop." /></p>
      <button type="button" className={styles.kitButton} onClick={reset}><StorefrontText id="copy_d8b8392e2c542950" fallback="Try again" /></button>
      <p><Link href="/shop"><StorefrontText id="copy_f615e406a09357a8" fallback="Explore the tea shop" /></Link></p>
    </section>
  );
}
