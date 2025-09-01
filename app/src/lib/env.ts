export const env = {
  KONG_GATEWAY_URL: process.env.KONG_GATEWAY_URL ?? "",
  APP_BASE_URL: process.env.APP_BASE_URL ?? "",
  SESSION_SECRET: process.env.SESSION_SECRET ?? "",
};

function assertEnv(key: keyof typeof env) {
  if (!env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

export function validateRequiredEnv() {
  assertEnv("KONG_GATEWAY_URL");
  assertEnv("APP_BASE_URL");
}


