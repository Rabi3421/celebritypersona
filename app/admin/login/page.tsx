import { redirect } from "next/navigation";
import { LoginForm } from "@/components/admin/LoginForm";
import { readSession } from "@/lib/auth/session";
import styles from "@/app/admin/admin.module.css";

type Props = { searchParams: Promise<{ from?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { from } = await searchParams;
  const target = from?.startsWith("/admin") ? from : "/admin";
  // Already signed in, by the check that also sees "Sign out everywhere".
  if (await readSession()) redirect(target);

  return (
    <div className={styles.shell}>
      <div className={styles.loginWrap}>
        <div className={styles.card}>
          <p className={styles.mark}>
            <i />
            CelebrityPersona
          </p>
          <h1>Sign in</h1>
          <p>This panel is for one account. There is no sign-up and no reset.</p>
          <LoginForm from={target} />
          <p className={styles.note}>
            Attempts are rate limited. You stay signed in while you work, and are
            signed out after a day without activity, or 30 days after signing in.
          </p>
        </div>
      </div>
    </div>
  );
}
