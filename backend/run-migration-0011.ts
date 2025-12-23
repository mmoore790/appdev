import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./src/db";

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log("📖 Reading migration file...");
    const migrationPath = join(__dirname, "migrations", "0011_add_asset_tracking.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🚀 Executing migration...");
    console.log("⚠️  This will add asset tracking fields to equipment table:");
    console.log("   - make and model fields");
    console.log("   - warranty_duration_months and warranty_expiry_date fields");
    console.log("   - Make type_id nullable");
    console.log("   - Create unique index on serial_number per business\n");

    // Execute the entire migration as one transaction
    await client.query("BEGIN");
    
    try {
      // Execute the migration SQL
      await client.query(migrationSQL);
      
      await client.query("COMMIT");
      console.log("\n✅ Migration completed successfully!");
      console.log("✅ Asset tracking fields added to equipment table");
      console.log("✅ Unique index created on serial_number per business");
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







