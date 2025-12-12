import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./src/db";

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log("📖 Reading migration file...");
    const migrationPath = join(__dirname, "migrations", "0013_add_job_sheet_tables.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🚀 Executing migration...");
    console.log("⚠️  This will create job sheet tables:");
    console.log("   - labour_entries table");
    console.log("   - parts_used table");
    console.log("   - job_notes table");
    console.log("   - job_attachments table");
    console.log("   - Indexes for performance\n");

    // Execute the entire migration as one transaction
    await client.query("BEGIN");
    
    try {
      // Execute the migration SQL
      await client.query(migrationSQL);
      
      await client.query("COMMIT");
      console.log("\n✅ Migration completed successfully!");
      console.log("✅ labour_entries table created");
      console.log("✅ parts_used table created");
      console.log("✅ job_notes table created");
      console.log("✅ job_attachments table created");
      console.log("✅ Indexes created");
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






