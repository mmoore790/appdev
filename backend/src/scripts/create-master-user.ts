import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool, db } from '../db';
import { users, businesses } from '../shared/schema';
import { eq, sql, and } from 'drizzle-orm';

async function createMasterUser() {
  try {
    // Master user credentials
    const username = 'matty55676';
    const password = 'LegacyPass790!';
    const fullName = 'Matthew Moore';
    const email = 'matthew.moore.contact@gmail.com';
    const role = 'master';
    
    console.log('Hashing password...');
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);
    
    // First, check if a business exists. If not, create a default one for the master user
    console.log('Checking for existing businesses...');
    const existingBusinesses = await db.select().from(businesses).limit(1);
    
    let businessId: number;
    if (existingBusinesses.length === 0) {
      console.log('No businesses found. Creating default business for master user...');
      const [newBusiness] = await db.insert(businesses).values({
        name: 'Master Business',
        email: email,
        isActive: true,
      }).returning();
      businessId = newBusiness.id;
      console.log(`Created business with ID: ${businessId}`);
    } else {
      businessId = existingBusinesses[0].id;
      console.log(`Using existing business with ID: ${businessId}`);
    }
    
    // Check if user already exists by email
    console.log('Checking if user already exists...');
    const existingUserByEmail = await db.select().from(users).where(eq(users.email, email)).limit(1);
    
    if (existingUserByEmail.length > 0) {
      console.log('User with this email already exists. Updating to master role...');
      await db.update(users)
        .set({
          password: hashedPassword,
          role: role,
          username: username,
          fullName: fullName,
          businessId: businessId,
          isActive: true,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(users.email, email));
      console.log('Master user updated successfully!');
    } else {
      // Check if username exists in this business
      const existingUserByUsername = await db.select()
        .from(users)
        .where(sql`${users.username} = ${username} AND ${users.businessId} = ${businessId}`)
        .limit(1);
      
      if (existingUserByUsername.length > 0) {
        console.log('User with this username already exists. Updating to master role...');
        await db.update(users)
          .set({
            password: hashedPassword,
            role: role,
            email: email,
            fullName: fullName,
            businessId: businessId,
            isActive: true,
            updatedAt: new Date().toISOString(),
          })
          .where(sql`${users.username} = ${username} AND ${users.businessId} = ${businessId}`);
        console.log('Master user updated successfully!');
      } else {
        console.log('Creating new master user...');
        await db.insert(users).values({
          username: username,
          password: hashedPassword,
          fullName: fullName,
          email: email,
          role: role,
          businessId: businessId,
          isActive: true,
        });
        console.log('Master user created successfully!');
      }
    }
    
    console.log('\n=== Master User Credentials ===');
    console.log(`Username: ${username}`);
    console.log(`Email: ${email}`);
    console.log(`Password: ${password}`);
    console.log(`Role: ${role}`);
    console.log(`Business ID: ${businessId}`);
    console.log('\nYou can now log in and access the Master Dashboard at /master');
  } catch (error) {
    console.error('Error creating master user:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

createMasterUser();

