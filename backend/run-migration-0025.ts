import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./src/db";

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log("📖 Reading migration file...");
    const migrationPath = join(__dirname, "migrations", "0025_add_job_internal_notes.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🚀 Executing migration...");
    console.log("⚠️  This will create job_internal_notes table.\n");

    await client.query("BEGIN");
    try {
      await client.query(migrationSQL);
      await client.query("COMMIT");
      console.log("\n✅ Migration completed successfully!");
      console.log("✅ Created job_internal_notes table");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
    }
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

runMigration();
