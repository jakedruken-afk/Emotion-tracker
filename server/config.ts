import path from "node:path";
import { loadProjectEnv } from "./loadEnv";

loadProjectEnv();

const environment = process.env.NODE_ENV ?? "development";

export const isProduction =
  environment === "production" || process.env.LAMB_PRODUCTION_MODE === "true";

export const sessionSecret =
  process.env.SESSION_SECRET ??
  (isProduction ? "" : "lamb-dev-session-secret-change-me");

if (isProduction && sessionSecret.length < 16) {
  throw new Error(
    "SESSION_SECRET must be set to a strong value before starting in production mode.",
  );
}

export const sessionCookieName = process.env.SESSION_COOKIE_NAME ?? "lamb_session";
export const sessionTtlHours = Number(process.env.SESSION_TTL_HOURS ?? 168);
export const inviteTtlHours = Number(process.env.INVITE_TTL_HOURS ?? 168);
export const appBaseUrl =
  process.env.APP_BASE_URL ??
  (isProduction ? "http://localhost:3001" : "http://localhost:5173");
export const databasePath =
  process.env.DATABASE_PATH ??
  path.resolve(process.cwd(), "data", "emotion-tracker.db");
export const backupDir =
  process.env.BACKUP_DIR ?? path.resolve(process.cwd(), "backups");
export const trustProxy =
  process.env.TRUST_PROXY === "true" || (isProduction && process.env.TRUST_PROXY !== "false");
export const enableDemoSeed =
  process.env.ENABLE_DEMO_SEED != null
    ? process.env.ENABLE_DEMO_SEED === "true"
    : !isProduction;

export const secureCookies = isProduction;
