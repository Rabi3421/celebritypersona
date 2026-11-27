"use client";

import Link, { useLinkStatus } from "next/link";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import local from "@/components/admin/look-jobs.module.css";

/** A form's submit button that shows it is working: spinner, its own label, and no double clicks. */
export function PendingButton({ children, pendingLabel, className }: { children: ReactNode; pendingLabel: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending || undefined}>
      {pending ? (
        <>
          <span className={local.spinner} aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function LinkLabel({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useLinkStatus();
  return pending ? (
    <>
      <span className={local.spinner} aria-hidden="true" />
      {pendingLabel}
    </>
  ) : (
    <>{children}</>
  );
}

/** A link that shows it is loading the next page. */
export function PendingLink({ href, children, pendingLabel, className }: { href: string; children: ReactNode; pendingLabel: string; className?: string }) {
  return (
    <Link href={href} className={className}>
      <LinkLabel pendingLabel={pendingLabel}>{children}</LinkLabel>
    </Link>
  );
}
