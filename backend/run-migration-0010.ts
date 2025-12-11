import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./src/db";

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log("📖 Reading migration file...");
    const migrationPath = join(__dirname, "migrations", "0010_add_job_tracker_enabled.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🚀 Executing migration...");
    console.log("⚠️  This will add job_tracker_enabled column to businesses table.\n");

    // Execute the entire migration as one transaction
    await client.query("BEGIN");
    
    try {
      // Execute the migration SQL
      await client.query(migrationSQL);
      
      await client.query("COMMIT");
      console.log("\n✅ Migration completed successfully!");
      console.log("✅ job_tracker_enabled column added to businesses table");
      console.log("✅ Default value set to true for all existing businesses");
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




