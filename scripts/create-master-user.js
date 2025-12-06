import bcrypt from 'bcryptjs';
import { pool, db } from '../backend/src/db.js';

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
    const businessesResult = await db.execute(`
      SELECT id FROM businesses ORDER BY id LIMIT 1
    `);
    
    let businessId;
    if (businessesResult.rows.length === 0) {
      console.log('No businesses found. Creating default business for master user...');
      const businessResult = await db.execute(`
        INSERT INTO businesses (name, email, is_active, created_at)
        VALUES ('Master Business', '${email}', true, NOW())
        RETURNING id
      `);
      businessId = businessResult.rows[0].id;
      console.log(`Created business with ID: ${businessId}`);
    } else {
      businessId = businessesResult.rows[0].id;
      console.log(`Using existing business with ID: ${businessId}`);
    }
    
    // Check if user already exists by email or username
    console.log('Checking if user already exists...');
    const existingUserByEmail = await db.execute(`
      SELECT * FROM users WHERE email = '${email}'
    `);
    
    const existingUserByUsername = await db.execute(`
      SELECT * FROM users WHERE username = '${username}' AND business_id = ${businessId}
    `);
    
    if (existingUserByEmail.rows.length > 0) {
      console.log('User with this email already exists. Updating to master role...');
      await db.execute(`
        UPDATE users 
        SET password = '${hashedPassword}', 
            role = '${role}',
            username = '${username}',
            full_name = '${fullName}',
            business_id = ${businessId},
            is_active = true,
            updated_at = NOW()
        WHERE email = '${email}'
      `);
      console.log('Master user updated successfully!');
    } else if (existingUserByUsername.rows.length > 0) {
      console.log('User with this username already exists. Updating to master role...');
      await db.execute(`
        UPDATE users 
        SET password = '${hashedPassword}', 
            role = '${role}',
            email = '${email}',
            full_name = '${fullName}',
            business_id = ${businessId},
            is_active = true,
            updated_at = NOW()
        WHERE username = '${username}' AND business_id = ${businessId}
      `);
      console.log('Master user updated successfully!');
    } else {
      console.log('Creating new master user...');
      await db.execute(`
        INSERT INTO users (username, password, full_name, email, role, business_id, is_active, created_at)
        VALUES ('${username}', '${hashedPassword}', '${fullName}', '${email}', '${role}', ${businessId}, true, NOW())
      `);
      console.log('Master user created successfully!');
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

