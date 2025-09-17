export const KONG_GATEWAY_URL = process.env.KONG_GATEWAY_URL ?? "http://localhost:8000";
export const DEAL_OWNER_ID = process.env.DEAL_OWNER_ID ?? "";
export const DEAL_STAGE_NEW_ID = process.env.DEAL_STAGE_NEW_ID ?? "";
export const DEAL_STAGE_CLOSED_WON_ID = process.env.DEAL_STAGE_CLOSED_WON_ID ?? "";
export const DEAL_STAGE_QUOTE_SUBMITTED_ID = process.env.DEAL_STAGE_QUOTE_SUBMITTED_ID ?? "";
export const DEAL_STAGE_INVOICE_SUBMITTED_ID = process.env.DEAL_STAGE_INVOICE_SUBMITTED_ID ?? "";
export const DEAL_STAGE_PAYMENT_SUBMITTED_ID = process.env.DEAL_STAGE_PAYMENT_SUBMITTED_ID ?? "";
export const DEAL_STAGE_PAYMENT_FAILURE_ID = process.env.DEAL_STAGE_PAYMENT_FAILURE_ID ?? "";
export const DEAL_NAME = process.env.DEAL_NAME ?? "Inspection Deal";
// Default Directus role id for newly created users
export const CLIENT_ROLE_ID = process.env.CLIENT_ROLE_ID ?? process.env.DIRECTUS_DEFAULT_ROLE_ID ?? "";
// Kong route for Google Places Autocomplete; override if your gateway uses a different path
export const GOOGLE_AUTOCOMPLETE_PATH = process.env.GOOGLE_AUTOCOMPLETE_PATH ?? "/maps/api/place/autocomplete/json";
// OpenAI model (proxied via Kong)
export const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-5";
export const OPENAI_ENABLE_WEBSEARCH = (process.env.OPENAI_ENABLE_WEBSEARCH ?? "true").toLowerCase() !== "false";
export const VERIFY_SERVICE_SID = process.env.VERIFY_SERVICE_SID ?? "";
export const VERIFY_SANDBOX_ENABLED = process.env.VERIFY_SANDBOX_ENABLED === "true";
export const VERIFY_SANDBOX_CODE = process.env.VERIFY_SANDBOX_CODE ?? "000000";
// Proposal defaults
export const PROPOSAL_NAME = process.env.PROPOSAL_NAME ?? "New Proposal";
export const PROPOSAL_STATUS = process.env.PROPOSAL_STATUS ?? "submitted";
export const PROPOSAL_EXPIRY_DAYS = Number(process.env.PROPOSAL_EXPIRY_DAYS ?? "7");
// Redirect countdown (in seconds) when phone is already verified on step 03
export const PHONE_VERIFIED_REDIRECT_SECONDS = Number(process.env.PHONE_VERIFIED_REDIRECT_SECONDS ?? "3");
// Absolute base URL of this Next.js app (e.g., https://example.com). If unset, we will derive from request headers.
export const APP_BASE_URL = process.env.APP_BASE_URL ?? "";
// Invoice defaults
export const INVOICE_DUE_DAYS = Number(process.env.INVOICE_DUE_DAYS ?? "7");
export const INVOICE_NUMBER_PREFIX = process.env.INVOICE_NUMBER_PREFIX ?? "OI-";
export const INVOICE_STATUS = process.env.INVOICE_STATUS ?? "submitted";
export const QUOTE_NUMBER_PREFIX = process.env.QUOTE_NUMBER_PREFIX ?? "Q-";
// Stripe
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
export const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
export const DIRECTUS_APP_URL = process.env.DIRECTUS_APP_URL ?? "http://localhost:3000";
// Cookie domain for auth cookies (e.g., .example.com). Leave empty to omit domain attribute.
export const FORM_COOKIE_DOMAIN = process.env.FORM_COOKIE_DOMAIN ?? "";
// Redis (removed)
// Dashboard app base URL (Next.js app). Used for redirects like "Book Now".
export const APP_DASHBOARD_URL = process.env.APP_DASHBOARD_URL ?? "http://localhost:8040";
// Website URLs for navigation
export const HOME_WEBSITE_URL = process.env.HOME_WEBSITE_URL ?? "https://ownerinspections.com.au";
export const FORM_WEBSITE_URL = process.env.FORM_WEBSITE_URL ?? "https://form.owner-inspections.com.au";

// Payment failure reasons (static defaults)
export const FAILED_REASON_REQUIRES_CONFIRMATION = process.env.FAILED_REASON_REQUIRES_CONFIRMATION ?? "Payment method attached, needs confirmation";
export const FAILED_REASON_REQUIRES_ACTION = process.env.FAILED_REASON_REQUIRES_ACTION ?? "Customer must authenticate (3DS, OTP)";
export const FAILED_REASON_PROCESSING = process.env.FAILED_REASON_PROCESSING ?? "Bank processing, waiting on result";
export const FAILED_REASON_REQUIRES_CAPTURE = process.env.FAILED_REASON_REQUIRES_CAPTURE ?? "PaymentIntent canceled";
