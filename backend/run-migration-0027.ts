import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./src/db";

async function runMigration() {
  const client = await pool.connect();

  try {
    console.log("📖 Reading migration file...");
    const migrationPath = join(__dirname, "migrations", "0027_add_machine_image_url.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🚀 Executing migration...");
    console.log("⚠️  This will add machine_image_url column to jobs table.\n");

    await client.query("BEGIN");
    try {
      await client.query(migrationSQL);
      await client.query("COMMIT");
      console.log("\n✅ Migration completed successfully!");
      console.log("✅ Added machine_image_url column to jobs table");
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
