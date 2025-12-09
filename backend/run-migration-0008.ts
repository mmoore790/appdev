import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./src/db";

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log("📖 Reading migration file...");
    const migrationPath = join(__dirname, "migrations", "0008_add_universal_order_management.sql");
    const migrationSQL = readFileSync(migrationPath, "utf-8");

    console.log("🚀 Executing migration 0008: Universal Order Management...");
    console.log("⚠️  This will create:");
    console.log("   - orders table");
    console.log("   - order_items table");
    console.log("   - order_status_history table");
    console.log("   - All necessary indexes and foreign keys\n");

    // Execute the entire migration as one transaction
    await client.query("BEGIN");
    
    try {
      // Execute the migration SQL
      await client.query(migrationSQL);
      
      await client.query("COMMIT");
      console.log("\n✅ Migration completed successfully!");
      console.log("✅ Orders table created");
      console.log("✅ Order items table created");
      console.log("✅ Order status history table created");
      console.log("✅ Indexes and foreign keys created");
      console.log("\n🎉 Universal Order Management system is now ready to use!");
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



