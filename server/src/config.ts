/** Env vars the server cannot run without. Checked once at startup (fail fast). */
const REQUIRED = ["MONGODB_URI", "JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET", "GEMINI_API_KEY"] as const;

export function checkEnv(): void {
  const missing = REQUIRED.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Missing env vars: ${missing.join(", ")}. See server/.env.example.`);
  }
}

/** Read an env var that checkEnv() already guaranteed. */
export function env(name: (typeof REQUIRED)[number]): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const isProd = () => process.env.NODE_ENV === "production";
