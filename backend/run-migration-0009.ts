import "dotenv/config";
import { readFileSync } from "fs";
import { join } from "path";
import { pool } from "./src/db";

const migrationFile = join(__dirname, "migrations", "0009_update_order_schema_simplify.sql");

async function runMigration() {
  const client = await pool.connect();
  
  try {
    console.log("📖 Reading migration file...");
    const sql = readFileSync(migrationFile, "utf-8");
    
    console.log("🚀 Executing migration 0009: Update Order Schema...");
    console.log("⚠️  This will:");
    console.log("   - Add supplier_notes column");
    console.log("   - Remove supplier_contact, supplier_email, supplier_phone columns");
    console.log("   - Add is_ordered column to order_items");
    console.log("   - Remove item_category column from order_items");
    console.log("   - Update default status to 'not_ordered'");
    console.log("");

    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    console.log("✅ Migration completed successfully!");
    console.log("✅ Schema updated");
    process.exit(0);
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", error);
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

