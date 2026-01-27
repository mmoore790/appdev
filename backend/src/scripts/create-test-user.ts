import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, db } from '../db';
import { users, businesses } from '../shared/schema';
import { eq, sql } from 'drizzle-orm';

async function createTestUser() {
  try {
    // Test user credentials
    const username = 'testuser';
    const password = 'password123';
    const fullName = 'Test User';
    const email = 'test@example.com';
    const role = 'admin';
    
    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // First, check if a business exists. If not, create a default one
    console.log('Checking for existing businesses...');
    const existingBusinesses = await db.select().from(businesses).limit(1);
    
    let businessId: number;
    if (existingBusinesses.length === 0) {
      console.log('No businesses found. Creating default business for test user...');
      const [newBusiness] = await db.insert(businesses).values({
        name: 'Test Business',
        email: email,
        isActive: true,
      }).returning();
      businessId = newBusiness.id;
      console.log(`Created business with ID: ${businessId}`);
    } else {
      businessId = existingBusinesses[0].id;
      console.log(`Using existing business with ID: ${businessId}`);
    }
    
    // Check if user already exists by username in this business
    console.log('Checking if user already exists...');
    const existingUser = await db.select()
      .from(users)
      .where(sql`${users.username} = ${username} AND ${users.businessId} = ${businessId}`)
      .limit(1);
    
    if (existingUser.length > 0) {
      console.log('Test user already exists. Updating password...');
      await db.update(users)
        .set({
          password: hashedPassword,
          role: role,
          email: email,
          fullName: fullName,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(sql`${users.username} = ${username} AND ${users.businessId} = ${businessId}`);
      console.log('Test user updated successfully!');
    } else {
      console.log('Creating new test user...');
      await db.insert(users).values({
        username: username,
        password: hashedPassword,
        fullName: fullName,
        email: email,
        role: role,
        businessId: businessId,
        isActive: true,
      });
      console.log('Test user created successfully!');
    }
    
    console.log('\n=== Test User Credentials ===');
    console.log(`Username: ${username}`);
    console.log(`Password: ${password}`);
    console.log(`Email: ${email}`);
    console.log(`Role: ${role}`);
    console.log(`Business ID: ${businessId}`);
    console.log('\nYou can now log in with these credentials!');
  } catch (error) {
    console.error('Error creating test user:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createTestUser();

