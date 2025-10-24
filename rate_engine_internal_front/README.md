# Rate Engine Internal Front

Internal testing tool for the rate engine API.

## Getting Started

1. Install dependencies:

```bash
npm install
```

2. Create a `.env.local` file based on `.env.example`:

```bash
cp .env.example .env.local
```

3. Make sure the rate engine internal API is running on port 8020:

```bash
cd ../rate_engine_internal
uvicorn app:app --reload --port 8020
```

4. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:8031](http://localhost:8031) in your browser.

## Features

- Select service type from dropdown
- Dynamic form fields based on selected service
- Toggle switches for boolean options
- Toggle switches for addons
- Real-time API response display
- Automatic calculation on form change (debounced)
- Detailed breakdown of prices, stages, and addons
- Raw JSON response viewer

## Services Supported

- Pre Purchase
- Pre Sales
- Apartment Pre Settlement
- New Construction Stages
- Dilapidation
- Insurance Report
- Defects Investigation
- Expert Witness Report
- Pre Handover
- Drug Resistance

## Configuration

Set the API URL in `.env.local`:

```
RATE_ENGINE_INTERNAL_API_URL=http://127.0.0.1:8020
```

Note: Use `127.0.0.1` instead of `localhost` to avoid DNS resolution issues with Next.js server-side fetch.

