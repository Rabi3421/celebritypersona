import Link from "next/link";
import Image from "next/image";

export function Brand({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={className ? `brand ${className}` : "brand"}
      aria-label="CelebrityPersona home"
    >
      {/*
        The logo sits above the fold on every page, so it must not be deferred:
        lazily loaded it became the LCP element on any page whose hero had not
        painted yet.

        `sizes` is not optional here, it is the half that makes `eager` safe.
        In Next 16 an eagerly loaded image is also preloaded, and that preload
        is emitted before the hero's because the nav is higher in the tree —
        so without a size hint the browser was told to fetch the logo at the
        1920px and 3840px candidates its intrinsic 1230px width implies, ahead
        of the image the page is actually judged on. The logo is drawn at
        196px (220px in the footer, 178px on a phone), so naming 220px lets it
        preload one small file that resolves long before the hero needs the
        connection.

        `preload` (which replaced the deprecated `priority` in Next 16) is
        deliberately not used: it would say this is the page's most important
        image, and on every page here it is not.
      */}
      <Image
        className="brand-logo"
        src="/brand/celebritypersona-logo.png"
        width={1230}
        height={252}
        alt="CelebrityPersona"
        loading="eager"
        sizes="220px"
      />
    </Link>
  );
}
