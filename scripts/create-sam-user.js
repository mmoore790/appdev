/**
 * Create Sam User Script
 * 
 * This script creates a mechanic user:
 * Username: smoore
 * Password: password1
 * Name: Sam
 * Role: mechanic
 */

import bcryptjs from 'bcryptjs';
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { users } from '../shared/schema.ts';

const { Pool } = pg;

async function hashPassword(password) {
  return await bcryptjs.hash(password, 10);
}

async function createSamUser() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const hashedPassword = await hashPassword('password1');
    
    const newUser = {
      username: 'smoore',
      password: hashedPassword,
      fullName: 'Sam',
      email: 'sam@mooresmowers.co.uk',
      role: 'mechanic'
    };

    const result = await db.insert(users).values(newUser).returning();
    
    console.log('✅ Sam user created successfully:', {
      id: result[0].id,
      username: result[0].username,
      fullName: result[0].fullName,
      role: result[0].role
    });

  } catch (error) {
    console.error('❌ Error creating Sam user:', error);
  } finally {
    await pool.end();
  }
}

createSamUser();