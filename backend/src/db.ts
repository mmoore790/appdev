import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";

function resolveDatabaseUrl(): string {
  const envUrl = process.env.DATABASE_URL?.trim();
  if (envUrl) {
    return envUrl;
  }

  const { PGHOST, PGDATABASE, PGUSER } = process.env;
  if (PGHOST && PGDATABASE && PGUSER) {
    const port = process.env.PGPORT?.trim() || "5432";
    const userPart = encodeURIComponent(PGUSER);
    const passwordPart =
      process.env.PGPASSWORD != null && process.env.PGPASSWORD !== ""
        ? `:${encodeURIComponent(process.env.PGPASSWORD)}`
        : "";

    return `postgresql://${userPart}${passwordPart}@${PGHOST}:${port}/${PGDATABASE}`;
  }

  throw new Error(
    "DATABASE_URL must be set, or provide PGHOST, PGDATABASE, and PGUSER (plus optional PGPASSWORD/PGPORT).",
  );
}

function shouldUseSSL(connectionString: string): boolean {
  const explicit = process.env.DB_SSL?.toLowerCase();
  if (explicit !== undefined) {
    return explicit === "true" || explicit === "1";
  }

  const sslMode = process.env.PGSSLMODE?.toLowerCase();
  if (sslMode && ["require", "verify-ca", "verify-full"].includes(sslMode)) {
    return true;
  }

  if (/sslmode=(require|verify-full|verify-ca)/i.test(connectionString)) {
    return true;
  }

  if (/localhost|127\.0\.0\.1/i.test(connectionString)) {
    return false;
  }

  if (connectionString.includes("neon.tech") || connectionString.includes("render.com")) {
    return true;
  }

  return false;
}

const connectionString = resolveDatabaseUrl();
const useSSL = shouldUseSSL(connectionString);

// Ensure downstream consumers see the fully constructed connection string
process.env.DATABASE_URL = connectionString;

export const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
});

pool.on("error", (err) => {
  console.error("Unexpected Postgres client error", err);
});

export const db = drizzle(pool, { schema });
