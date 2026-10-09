# MercadoLibs / NotiVenta Web

This Next.js repository currently contains two integration generations:

- the legacy MercadoLibs dashboard, whose Node routes own inventory, Telegram,
  billing, and the original Mercado Libre session; and
- the transitional NotiVenta V2 surface at `/v2/connect`, which uses Clerk and
  calls the separate FastAPI backend for Mercado Libre connection and Device
  management.

Do not treat the legacy and V2 Mercado Libre callbacks as interchangeable. The
V2 staging configuration is documented in
[`docs/deploy-runbook.md`](docs/deploy-runbook.md).

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

Open [http://localhost:3000](http://localhost:3000) with your browser to see the
application. The transitional V2 connection page is at
[http://localhost:3000/v2/connect](http://localhost:3000/v2/connect), and the
protected V2 workstation shell is at
[http://localhost:3000/v2/workstation](http://localhost:3000/v2/workstation).
The workstation displays the authenticated user's read-only fulfillment queue,
including persisted packing snapshots and backend-derived dispatch state. It
does not expose printing or queue lifecycle actions. The workstation uses one
full-width operational surface: connection and Device configuration remain at
the top, followed by a simple read-only queue table. Q6 local
workstation acceptance is complete: the local Dummy Mercado Libre flow was
observed through webhook ingestion, `PrintJob`, order enrichment, persisted
packing snapshot, queue API, and workstation. The queue loads immediately,
polls every 15 seconds while the page is visible, and refreshes again when the
page regains focus or visibility. Background refresh preserves the last
successful queue while the replacement request is in flight. The table
presents available packing details directly in its rows. Historical jobs
created before fulfillment enrichment may remain `PENDING` with zero units;
the workstation labels those details as pending without treating that as a
printing failure. No print, lifecycle mutation, label download, or physical
output is part of this workstation.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

The current V2 staging frontend runs on Railway. Follow the checked-in staging
runbook rather than the generic create-next-app deployment instructions.
