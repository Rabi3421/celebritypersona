import Link from "next/link";
import Image from "next/image";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={className ? `brand ${className}` : "brand"}
      aria-label="CelebrityPersona home"
    >
      <Image
        className="brand-logo"
        src="/brand/celebritypersona-logo.png"
        width={1230}
        height={252}
        alt="CelebrityPersona"
      />
    </Link>
  );
}
