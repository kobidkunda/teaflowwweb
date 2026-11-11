import { Text as StorefrontText } from "@/components/international/InternationalProvider";
import styles from "@/components/trials/TrialsCollection.module.css";

export default function TrialsLoading() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <p><StorefrontText id="copy_9aaedfc1a4f37afb" fallback="Opening the discovery shelf…" /></p>
      <span><StorefrontText id="copy_ef7188968e31ad78" fallback="Getting the latest kits, contents and prices." /></span>
    </div>
  );
}
