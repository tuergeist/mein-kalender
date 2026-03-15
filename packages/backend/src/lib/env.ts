const REQUIRED_VARS = [
  "DATABASE_URL",
  "REDIS_URL",
  "NEXTAUTH_SECRET",
  "ENCRYPTION_SECRET",
] as const;

export function validateEnv(): void {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    console.error(
      `Missing required environment variables:\n${missing.map((k) => `  - ${k}`).join("\n")}`
    );
    process.exit(1);
  }
}
