/**
 * Create Multiple Users Script
 * 
 * This script creates multiple users with specified credentials and roles
 */

import { db } from '../server/db.ts';
import { users } from '../shared/schema.ts';
import bcrypt from 'bcryptjs';

async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

async function createUsers() {
  try {
    console.log('Creating multiple users...');

    const usersToCreate = [
      {
        username: 'reg123',
        password: 'mooreadmin',
        fullName: 'Reggie Moore',
        email: 'reggie@mooresmowers.co.uk',
        role: 'admin'
      },
      {
        username: 'dam!en',
        password: 'damien12!345',
        fullName: 'Damien',
        email: 'damien@mooresmowers.co.uk',
        role: 'mechanic'
      },
      {
        username: 'kyle520!',
        password: 'password2!',
        fullName: 'Kyle',
        email: 'kyle@mooresmowers.co.uk',
        role: 'mechanic'
      },
      {
        username: 'yasmin1',
        password: 'password1!',
        fullName: 'Yasmin',
        email: 'yasmin@mooresmowers.co.uk',
        role: 'admin'
      }
    ];

    for (const userData of usersToCreate) {
      const hashedPassword = await hashPassword(userData.password);
      
      const result = await db.insert(users).values({
        username: userData.username,
        password: hashedPassword,
        fullName: userData.fullName,
        email: userData.email,
        role: userData.role
      }).returning();

      console.log(`✓ Created user: ${userData.fullName} (${userData.username}) - Role: ${userData.role}`);
    }

    console.log('All users created successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error creating users:', error);
    process.exit(1);
  }
}

createUsers();