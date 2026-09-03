import { pending } from "@/lib/site-config";

/**
 * Details nobody can invent — the registered name, the address, the grievance
 * officer — used to publish as a loud amber "Add …" chip so they could not
 * ship unnoticed. They shipped anyway, and a reader (or Google, weighing who
 * stands behind the site) met an unfinished form on every legal page.
 *
 * So they are now simply absent in public until they are filled in. The admin
 * Settings page still lists exactly which ones are missing, which is where the
 * reminder belongs.
 */
export function Pending({ value }: { value: string }) {
  if (pending(value)) return null;
  return <>{value}</>;
}

/** A definition row that disappears whole rather than leaving a dangling label. */
export function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  if (value !== undefined && pending(value)) return null;
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value ?? children}</dd>
    </div>
  );
}
