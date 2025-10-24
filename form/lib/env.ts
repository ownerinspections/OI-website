// Environment validation utility
function validateEnvironment(): void {
	const errors: string[] = [];
	const warnings: string[] = [];

	// Critical environment variables that must be set
	const criticalVars = {
		KONG_GATEWAY_URL: "Kong API Gateway URL for backend communication",
		STRIPE_SECRET_KEY: "Stripe secret key for payment processing",
		VERIFY_SERVICE_SID: "Twilio Verify Service SID for phone verification",
	};

	// Important environment variables that should be set in production
	const importantVars = {
		APP_BASE_URL: "Base URL of the application (for production)",
		CLIENT_ROLE_ID: "Default role ID for new users",
	};

	// Check critical variables
	for (const [key, description] of Object.entries(criticalVars)) {
		const value = process.env[key];
		if (!value || value.trim() === "") {
			errors.push(`Missing critical environment variable: ${key} (${description})`);
		}
	}

	// Check important variables (warnings only)
	for (const [key, description] of Object.entries(importantVars)) {
		const value = process.env[key];
		if (!value || value.trim() === "") {
			warnings.push(`Missing important environment variable: ${key} (${description})`);
		}
	}

	// Log warnings
	if (warnings.length > 0) {
		console.warn("[ENV] Environment validation warnings:");
		warnings.forEach(warning => console.warn(`  - ${warning}`));
	}

	// Throw errors for critical missing variables
	if (errors.length > 0) {
		console.error("[ENV] Environment validation failed:");
		errors.forEach(error => console.error(`  - ${error}`));
		throw new Error(`Environment validation failed. Missing ${errors.length} critical variable(s). Check your .env file.`);
	}

	// Success message
	if (process.env.NODE_ENV !== "test") {
		console.log("[ENV] Environment validation passed ✓");
	}
}

// Validate environment on module load (only in non-test environments)
if (process.env.NODE_ENV !== "test" && typeof window === "undefined") {
	try {
		validateEnvironment();
	} catch (error) {
		// In development, show warning but don't crash
		if (process.env.NODE_ENV === "development") {
			console.warn("[ENV] Development mode: Continuing despite validation errors");
		} else {
			throw error;
		}
	}
}

export const KONG_GATEWAY_URL = process.env.KONG_GATEWAY_URL ?? "http://localhost:8000";
export const DEAL_OWNER_ID = process.env.DEAL_OWNER_ID ?? "";
export const DEAL_STAGE_NEW_ID = process.env.DEAL_STAGE_NEW_ID ?? "";
export const DEAL_STAGE_CLOSED_WON_ID = process.env.DEAL_STAGE_CLOSED_WON_ID ?? "";
export const DEAL_STAGE_QUOTE_SUBMITTED_ID = process.env.DEAL_STAGE_QUOTE_SUBMITTED_ID ?? "";
export const DEAL_STAGE_INVOICE_SUBMITTED_ID = process.env.DEAL_STAGE_INVOICE_SUBMITTED_ID ?? "";
export const DEAL_STAGE_PAYMENT_SUBMITTED_ID = process.env.DEAL_STAGE_PAYMENT_SUBMITTED_ID ?? "";
export const DEAL_STAGE_PAYMENT_FAILURE_ID = process.env.DEAL_STAGE_PAYMENT_FAILURE_ID ?? "";
export const DEAL_STAGE_BOOKED_ID = process.env.DEAL_STAGE_BOOKED_ID ?? "";
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
export const INVOICE_STATUS = process.env.INVOICE_STATUS ?? "submitted";
// Stripe
export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? "";
export const STRIPE_PUBLISHABLE_KEY = process.env.STRIPE_PUBLISHABLE_KEY ?? "";
export const DIRECTUS_APP_URL = process.env.DIRECTUS_APP_URL ?? "http://localhost:3000";
// Redis (removed)
// Dashboard app base URL (Next.js app). Used for redirects like "Book Now".
export const APP_DASHBOARD_URL = process.env.APP_DASHBOARD_URL ?? "http://localhost:8040";

// Payment failure reasons (static defaults)
export const FAILED_REASON_REQUIRES_CONFIRMATION = process.env.FAILED_REASON_REQUIRES_CONFIRMATION ?? "Payment method attached, needs confirmation";
export const FAILED_REASON_REQUIRES_ACTION = process.env.FAILED_REASON_REQUIRES_ACTION ?? "Customer must authenticate (3DS, OTP)";
export const FAILED_REASON_PROCESSING = process.env.FAILED_REASON_PROCESSING ?? "Bank processing, waiting on result";
export const FAILED_REASON_REQUIRES_CAPTURE = process.env.FAILED_REASON_REQUIRES_CAPTURE ?? "PaymentIntent canceled";

// Export validation function for manual validation if needed
export { validateEnvironment };
