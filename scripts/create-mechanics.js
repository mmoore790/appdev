/**
 * Create Mechanic Users Script
 * 
 * This script creates two mechanic users:
 * - Andy (username: Andy01, password: password5!)
 * - Finlay (username: Finlay07, password: password10!)
 */

import bcrypt from 'bcryptjs';
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { users } from '../shared/schema.ts';
import ws from 'ws';

// Configure the database connection (same as server/db.ts)
neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL must be set");
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle({ client: pool });

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function createMechanics() {
  try {
    console.log('Creating mechanic users...');
    
    // Hash passwords
    const andyPassword = await hashPassword('password5!');
    const finlayPassword = await hashPassword('password10!');
    
    // Create Andy
    const andyUser = await db.insert(users).values({
      username: 'Andy01',
      password: andyPassword,
      fullName: 'Andy',
      email: 'andy@mooresmowers.co.uk',
      role: 'mechanic',
      isActive: true
    }).returning();
    
    console.log('Created Andy:', andyUser[0]);
    
    // Create Finlay
    const finlayUser = await db.insert(users).values({
      username: 'Finlay07',
      password: finlayPassword,
      fullName: 'Finlay',
      email: 'finlay@mooresmowers.co.uk',
      role: 'mechanic',
      isActive: true
    }).returning();
    
    console.log('Created Finlay:', finlayUser[0]);
    
    console.log('✅ Both mechanic users created successfully!');
    
  } catch (error) {
    console.error('❌ Error creating mechanic users:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the script
createMechanics();