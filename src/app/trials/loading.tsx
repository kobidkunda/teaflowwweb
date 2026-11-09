import styles from "@/components/trials/TrialsCollection.module.css";

export default function TrialsLoading() {
  return (
    <div className={styles.loading} role="status" aria-live="polite">
      <p>Opening the discovery shelf…</p>
      <span>Getting the latest kits, contents and prices.</span>
    </div>
  );
}
