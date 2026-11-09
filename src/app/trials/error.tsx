"use client";

import Link from "next/link";
import styles from "@/components/trials/TrialsCollection.module.css";

export default function TrialsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className={`${styles.page} ${styles.error}`} aria-labelledby="trials-error-title">
      <h1 id="trials-error-title">The discovery shelf is taking a moment.</h1>
      <p>We couldn’t load the kits. Please try again, or explore the tea shop.</p>
      <button type="button" className={styles.kitButton} onClick={reset}>Try again</button>
      <p><Link href="/shop">Explore the tea shop</Link></p>
    </section>
  );
}
