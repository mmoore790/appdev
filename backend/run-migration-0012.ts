import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./src/db";

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log("📖 Reading migration file...");
    const migrationPath = join(__dirname, "migrations", "0012_combine_make_model.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🚀 Executing migration...");
    console.log("⚠️  This will combine make and model columns into a single make_model column:");
    console.log("   - Add make_model column");
    console.log("   - Migrate existing data (combine make and model)");
    console.log("   - Drop make and model columns\n");

    // Execute the entire migration as one transaction
    await client.query("BEGIN");
    
    try {
      // Execute the migration SQL
      await client.query(migrationSQL);
      
      await client.query("COMMIT");
      console.log("\n✅ Migration completed successfully!");
      console.log("✅ make and model columns combined into make_model");
      console.log("✅ Old columns removed");
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






