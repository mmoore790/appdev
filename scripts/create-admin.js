import bcrypt from 'bcryptjs';
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';
import 'dotenv/config';

// Configure the database connection
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function createAdmin() {
  try {
    // Admin credentials
    const username = 'kyleisloopy';
    const password = 'kyle55FGH';
    const fullName = 'Kyle Admin';
    const email = 'kyle@moorehorticulture.com';
    
    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    console.log('Checking if user already exists...');
    const existingUsers = await db.execute(`
      SELECT * FROM users WHERE username = '${username}'
    `);
    
    if (existingUsers.rows.length > 0) {
      console.log('User already exists. Updating password...');
      await db.execute(`
        UPDATE users 
        SET password = '${hashedPassword}', 
            role = 'admin',
            is_active = true
        WHERE username = '${username}'
      `);
    } else {
      console.log('Creating new admin user...');
      await db.execute(`
        INSERT INTO users (username, password, full_name, email, role, is_active)
        VALUES ('${username}', '${hashedPassword}', '${fullName}', '${email}', 'admin', true)
      `);
    }
    
    console.log('Admin user created/updated successfully!');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
  } catch (error) {
    console.error('Error creating admin user:', error);
  } finally {
    await pool.end();
  }
}

createAdmin();