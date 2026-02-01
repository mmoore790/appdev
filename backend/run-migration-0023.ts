import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./src/db";

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log("📖 Reading migration file...");
    const migrationPath = join(__dirname, "migrations", "0023_add_order_counter_unique_numbers.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🚀 Executing migration 0023_add_order_counter_unique_numbers...");
    console.log("   - Creates order_counter table for unique order numbers");
    console.log("   - Fixes any existing duplicate order numbers");
    console.log("   - Adds unique constraint on (business_id, order_number)\n");

    // Execute the entire migration as one transaction
    await client.query("BEGIN");
    
    try {
      await client.query(migrationSQL);
      
      await client.query("COMMIT");
      console.log("\n✅ Migration completed successfully!");
      console.log("✅ order_counter table created");
      console.log("✅ Duplicate order numbers fixed");
      console.log("✅ Unique constraint added");
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
