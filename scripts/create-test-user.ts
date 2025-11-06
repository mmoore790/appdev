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
import { users } from "../shared/schema";
import { db } from "../server/db"; 
import { eq } from "drizzle-orm";

// Set up websocket for Neon database
neonConfig.webSocketConstructor = ws;

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function createTestUser() {
  try {
    console.log("Creating test user account...");
    
    // Check if user already exists
    const existingUsers = await db.select().from(users).where(eq(users.username, "testuser"));
    
    if (existingUsers.length > 0) {
      console.log("Test user already exists.");
      return;
    }
    
    // Generate hashed password
    const hashedPassword = await hashPassword("password123");
    
    // Insert user with admin role
    const [user] = await db.insert(users).values({
      username: "testuser",
      password: hashedPassword,
      fullName: "Test User",
      role: "admin", 
      email: "test@example.com",
      isActive: true,
      createdAt: new Date().toISOString()
    }).returning();
    
    console.log("Test user created successfully!");
    console.log(user);
    console.log("\nLogin credentials:");
    console.log("Username: testuser");
    console.log("Password: password123");
  } catch (error) {
    console.error("Error creating test user:", error);
  }
}

// Execute the function
createTestUser();