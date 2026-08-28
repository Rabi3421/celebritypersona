import { PENDING, pending } from "@/lib/site-config";
import styles from "./editorial.module.css";

/** Renders a site-config value, or a loud chip if it still needs filling in. */
export function Pending({ value }: { value: string }) {
  if (!pending(value)) return <>{value}</>;
  return <span className={styles.pendingChip}>Add {value.slice(PENDING.length)}</span>;
}
