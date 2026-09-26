This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Content and the database

All site content lives in MongoDB. The pages read it through `lib/db/content.ts`
and nothing imports a hardcoded array any more.

| Collection | Holds |
| --- | --- |
| `outfits` | Decoded looks and their pieces |
| `celebrities` | Style archives |
| `occasions` | Events, grouped for the occasion pages |
| `trendingSearches` | The search leaderboard |
| `siteContent` | Homepage editorial (`home`) and the trending FAQ |
| `priceReports` | Reader reports |
| `adminUsers` | The single admin account |

`lib/seed-data/` is the source those collections were loaded from. It is not read
at runtime. Edit it and re-seed to change the starting content:

```bash
npm run seed:content   # upserts every document, safe to re-run
npm run seed:admin     # sets the admin password, reads it on stdin
```

Public pages are prerendered, so these queries run at build time. The build needs
a reachable database.

No database to hand? `npm run mongo:local` starts a throwaway MongoDB on port
27018; point `MONGODB_URI` at it while you work.

## Development database

`next dev` refuses to start against the production cluster (`lib/db-guard.ts`).
Development reads its own connection string from `.env.development.local`, which
Next loads ahead of `.env`; the scripts keep reading `.env`.

```bash
# .env — production, as before, plus the production cluster's host:
MONGODB_PRODUCTION_HOST=cluster0.xxxxx.mongodb.net

# .env.development.local — development only:
MONGODB_URI=mongodb+srv://…the dev cluster…
```

Fill it from the newest dump in `.scratch/` with `npm run db:seed-dev`. It drops
and replaces what it restores, refuses a production target, and leaves out
`subscribers`, `mailJobs` and `mailDeliveries`.

Development shares the production Firebase bucket, so photo deletes are skipped
under `next dev` (set `ALLOW_STORAGE_DELETES_IN_DEV=1` to allow them). Uploads
made in development still land in the bucket.
