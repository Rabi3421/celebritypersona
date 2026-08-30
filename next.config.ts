import type { NextConfig } from "next";

const firebaseBucket =
  process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "celebritypersona-918fc.firebasestorage.app";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      new URL("https://picsum.photos/**"),
      // Firebase download URLs always carry ?alt=media&token=…, and the URL
      // form of this rule would forbid a query string, so spell it out and
      // scope the path to this bucket's objects.
      {
        protocol: "https",
        hostname: "firebasestorage.googleapis.com",
        pathname: `/v0/b/${firebaseBucket}/o/**`,
      },
    ],
  },
};

export default nextConfig;
