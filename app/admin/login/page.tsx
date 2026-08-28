import { LoginForm } from "@/components/admin/LoginForm";
import styles from "@/app/admin/admin.module.css";

type Props = { searchParams: Promise<{ from?: string }> };

export default async function LoginPage({ searchParams }: Props) {
  const { from } = await searchParams;
  const target = from?.startsWith("/admin") ? from : "/admin";

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
            Attempts are rate limited. Sessions expire after 8 hours.
          </p>
        </div>
      </div>
    </div>
  );
}
