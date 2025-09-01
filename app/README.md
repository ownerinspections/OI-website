This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Brand Guidelines

### Colors

- Primary Blue `#0b487b` (RGB 11, 72, 123)
- Secondary Blue `#2c9bd6` (RGB 44, 155, 214)
- Success Green `#10b981` (RGB 16, 185, 129)
- Warning Orange `#f59e0b` (RGB 245, 158, 11)
- Error Red `#ef4444` (RGB 239, 68, 68)
- Info Blue `#3b82f6` (RGB 59, 130, 246)
- Charcoal `#262626` (RGB 38, 38, 38)
- Dark Gray `#595959` (RGB 89, 89, 89)
- Medium Gray `#8c8c8c` (RGB 140, 140, 140)
- Light Gray `#d9d9d9` (RGB 217, 217, 217)
- Pale Gray `#f5f5f5` (RGB 245, 245, 245)
- White `#ffffff` (RGB 255, 255, 255)

Exposed as CSS variables in `src/app/globals.css`.

### Typography

- Primary font: Inter (Light, Regular, Medium, Semibold, Bold)
  - Use for body text, headlines, buttons, inputs, navigation, labels, tables, lists

### Environment

Create `.env` in `app/`:

```
KONG_GATEWAY_URL=http://localhost:8000
APP_BASE_URL=http://localhost:8040
# Next dev/start will read PORT automatically
PORT=8040
```

Run with:

```bash
pnpm dev
```

All server requests should use the Kong gateway.

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
