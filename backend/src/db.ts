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

let connectionString: string;
let useSSL: boolean;

try {
  connectionString = resolveDatabaseUrl();
  useSSL = shouldUseSSL(connectionString);
  
  // Ensure downstream consumers see the fully constructed connection string
  process.env.DATABASE_URL = connectionString;
  console.log('[DB] Database URL resolved successfully');
} catch (error) {
  console.error('[DB] ❌ Failed to resolve database URL:', error);
  // Re-throw so the error is visible, but log it first
  throw error;
}

// For serverless databases (like Neon), use a smaller pool size to avoid exceeding server limits
// Session mode typically allows fewer connections than regular PostgreSQL
const poolSize = parseInt(process.env.DB_POOL_SIZE || "10", 10);

console.log('[DB] Creating connection pool...');
export const pool = new Pool({
  connectionString,
  ssl: useSSL ? { rejectUnauthorized: false } : undefined,
  max: poolSize, // Reduced from 20 to avoid exceeding serverless database limits
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 30000, // Return an error after 30 seconds if connection could not be established
  allowExitOnIdle: true, // Allow process to exit when pool is idle
});
console.log('[DB] Connection pool created (not yet connected)');

pool.on("error", (err) => {
  console.error("Unexpected Postgres client error", err);
});

// Monitor pool usage for debugging
pool.on("connect", () => {
  console.log(`[DB Pool] Connection established. Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
});

pool.on("acquire", () => {
  if (pool.totalCount >= poolSize * 0.8) {
    console.warn(`[DB Pool] High connection usage: ${pool.totalCount}/${poolSize} connections in use`);
  }
});

// Log pool stats periodically
if (process.env.NODE_ENV !== 'production') {
  setInterval(() => {
    console.log(`[DB Pool Stats] Total: ${pool.totalCount}, Idle: ${pool.idleCount}, Waiting: ${pool.waitingCount}`);
  }, 60000); // Every minute
}

export const db = drizzle(pool, { schema });
