/**
 * Create Test User Script
 * 
 * This script creates a test user account for development purposes.
 * Username: testuser
 * Password: password123
 */

import { Pool, neonConfig } from "@neondatabase/serverless";
import bcrypt from "bcryptjs";
import ws from "ws";
import dotenv from "dotenv";

// Initialize environment variables
dotenv.config();

// Set up websocket for Neon database
neonConfig.webSocketConstructor = ws;

// Connect to the database
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function createTestUser() {
  const client = await pool.connect();
  
  try {
    console.log("Creating test user account...");
    
    // Check if user already exists
    const checkResult = await client.query(
      "SELECT * FROM users WHERE username = $1",
      ["testuser"]
    );
    
    if (checkResult.rows.length > 0) {
      console.log("Test user already exists.");
      return;
    }
    
    // Generate hashed password
    const hashedPassword = await hashPassword("password123");
    
    // Insert user with admin role
    const result = await client.query(
      `INSERT INTO users (username, password, full_name, role, email, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING id, username, role`,
      ["testuser", hashedPassword, "Test User", "admin", "test@example.com", true]
    );
    
    console.log("Test user created successfully!");
    console.log(result.rows[0]);
    console.log("\nLogin credentials:");
    console.log("Username: testuser");
    console.log("Password: password123");
  } catch (error) {
    console.error("Error creating test user:", error);
  } finally {
    client.release();
  }
  
  await pool.end();
}

// Execute the function
createTestUser();

// Need to export something for ES modules
export default createTestUser;