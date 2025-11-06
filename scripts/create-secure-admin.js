/**
 * Create Secure Admin User Script
 * 
 * This script creates a new admin user with secure credentials
 * Username: kyleisloopy
 * Password: kyle55FGH
 */

import { hash } from 'bcryptjs';

// Create a hash function to run the password hashing
async function hashPassword() {
  try {
    const password = 'kyle55FGH';
    // Use 12 rounds of salting for better security
    const salt = 12;
    const hashedPassword = await hash(password, salt);
    
    console.log('=============================================');
    console.log('SECURE PASSWORD HASH GENERATED SUCCESSFULLY');
    console.log('=============================================');
    console.log('Username: kyleisloopy');
    console.log('Password: kyle55FGH');
    console.log('Hashed Password: ' + hashedPassword);
    console.log('Copy the hash above to use in the SQL command');
    console.log('=============================================');
  } catch (error) {
    console.error('Error generating hash:', error);
  }
}

// Run the function
hashPassword();