# Marketing Site Integration Prompt

## Overview
You need to integrate the marketing website with the main application's database to enable automated subscription onboarding. When a user successfully purchases a subscription through Stripe, you need to save their subscription details to the database, then redirect them to complete account setup.

## Database Connection Setup

### Environment Variables Required
The marketing site needs access to the same PostgreSQL database. Set up these environment variables:

**Option 1: Full Connection String (Recommended)**
```env
DATABASE_URL=postgresql://username:password@host:port/database
```

**Option 2: Individual Connection Parameters**
```env
PGHOST=your-database-host
PGDATABASE=your-database-name
PGUSER=your-database-user
PGPASSWORD=your-database-password
PGPORT=5432  # Optional, defaults to 5432
DB_SSL=true  # Set to true for production (Neon, Render, etc.), false for localhost
```

**SSL Configuration:**
- For localhost: `DB_SSL=false` or omit
- For Neon.tech: `DB_SSL=true` (automatically detected)
- For Render.com: `DB_SSL=true` (automatically detected)
- For other cloud providers: Set `DB_SSL=true` if required

### Database Connection Code Example

```typescript
// Using pg (node-postgres) library
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 10, // Connection pool size
});

// Or using individual parameters
const pool = new Pool({
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT || '5432'),
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  max: 10,
});
```

## Subscriptions Table Schema

The `subscriptions` table has the following structure:

```sql
CREATE TABLE "subscriptions" (
  "id" serial PRIMARY KEY NOT NULL,
  "stripe_subscription_id" text,
  "stripe_customer_id" text,
  "business_id" integer,  -- NULL initially, populated after account creation
  "plan_name" text,        -- e.g., "starter", "professional", "enterprise"
  "status" text NOT NULL DEFAULT 'pending',  -- pending, active, cancelled, past_due, trialing
  "email" text NOT NULL,
  "current_period_start" timestamp,
  "current_period_end" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp,
  "account_created" boolean DEFAULT false NOT NULL
);
```

## Required Fields to Populate

When creating a subscription record, you **MUST** populate these fields:

### Required Fields:
- **`email`** (text, NOT NULL) - Customer's email address from Stripe checkout
- **`status`** (text, default: 'pending') - Subscription status from Stripe

### Recommended Fields (populate if available):
- **`stripe_subscription_id`** (text) - Stripe subscription ID (if using subscriptions)
- **`stripe_customer_id`** (text) - Stripe customer ID
- **`plan_name`** (text) - Plan identifier (e.g., "starter", "professional", "enterprise")
- **`current_period_start`** (timestamp) - Subscription period start date
- **`current_period_end`** (timestamp) - Subscription period end date

### Fields to Leave NULL Initially:
- **`business_id`** - Will be populated automatically when user creates account
- **`account_created`** - Automatically set to false (default)

## Integration Flow

### Step 1: Stripe Checkout Success

After a successful Stripe checkout (either one-time payment or subscription), you'll receive a webhook or have access to the checkout session. Extract the following information:

```typescript
// From Stripe checkout.session.completed event or checkout session object
const customerEmail = session.customer_email || session.customer_details?.email;
const stripeCustomerId = session.customer;
const stripeSubscriptionId = session.subscription; // If using subscriptions
const planName = session.metadata?.plan || 'starter'; // Extract from metadata
```

### Step 2: Create Subscription Record

Insert the subscription record into the database:

```typescript
async function createSubscriptionRecord(stripeData: {
  email: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  planName?: string;
  status?: string;
  currentPeriodStart?: Date;
  currentPeriodEnd?: Date;
}) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Check if subscription already exists for this email
    const existingCheck = await client.query(
      'SELECT id FROM subscriptions WHERE email = $1',
      [stripeData.email]
    );
    
    if (existingCheck.rows.length > 0) {
      // Update existing record
      await client.query(`
        UPDATE subscriptions 
        SET 
          stripe_customer_id = COALESCE($1, stripe_customer_id),
          stripe_subscription_id = COALESCE($2, stripe_subscription_id),
          plan_name = COALESCE($3, plan_name),
          status = COALESCE($4, status),
          current_period_start = COALESCE($5, current_period_start),
          current_period_end = COALESCE($6, current_period_end),
          updated_at = NOW()
        WHERE email = $7
      `, [
        stripeData.stripeCustomerId,
        stripeData.stripeSubscriptionId,
        stripeData.planName,
        stripeData.status || 'active',
        stripeData.currentPeriodStart,
        stripeData.currentPeriodEnd,
        stripeData.email
      ]);
    } else {
      // Insert new record
      await client.query(`
        INSERT INTO subscriptions (
          email,
          stripe_customer_id,
          stripe_subscription_id,
          plan_name,
          status,
          current_period_start,
          current_period_end,
          account_created
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, false)
      `, [
        stripeData.email,
        stripeData.stripeCustomerId || null,
        stripeData.stripeSubscriptionId || null,
        stripeData.planName || null,
        stripeData.status || 'pending',
        stripeData.currentPeriodStart || null,
        stripeData.currentPeriodEnd || null
      ]);
    }
    
    await client.query('COMMIT');
    console.log(`✅ Subscription record created/updated for ${stripeData.email}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error creating subscription record:', error);
    throw error;
  } finally {
    client.release();
  }
}
```

### Step 3: Redirect to Onboarding Page

After successfully creating the subscription record, redirect the user to the onboarding page:

```typescript
// After successful payment and database insert
const onboardingUrl = `${process.env.ONBOARDING_BASE_URL || 'https://your-app-domain.com'}/onboarding/setup-account?email=${encodeURIComponent(customerEmail)}`;

// Redirect user
window.location.href = onboardingUrl; // Client-side redirect
// OR
res.redirect(onboardingUrl); // Server-side redirect
```

## Complete Integration Example

### Stripe Webhook Handler (Recommended)

```typescript
import express from 'express';
import Stripe from 'stripe';

const app = express();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Stripe webhook endpoint
app.post('/webhook/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig!,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle checkout.session.completed event
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    
    // Extract data
    const email = session.customer_email || session.customer_details?.email;
    const stripeCustomerId = session.customer as string;
    const stripeSubscriptionId = session.subscription as string | undefined;
    const planName = session.metadata?.plan || 'starter';
    
    if (!email) {
      console.error('No email found in checkout session');
      return res.status(400).json({ error: 'No email in session' });
    }

    try {
      // Get subscription details if using subscriptions
      let currentPeriodStart: Date | undefined;
      let currentPeriodEnd: Date | undefined;
      let status = 'active';

      if (stripeSubscriptionId) {
        const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        status = subscription.status;
        currentPeriodStart = new Date(subscription.current_period_start * 1000);
        currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      }

      // Create subscription record
      await createSubscriptionRecord({
        email,
        stripeCustomerId,
        stripeSubscriptionId,
        planName,
        status,
        currentPeriodStart,
        currentPeriodEnd,
      });

      console.log(`✅ Subscription processed for ${email}`);
    } catch (error) {
      console.error('Error processing subscription:', error);
      // Don't fail the webhook - Stripe will retry
      return res.status(500).json({ error: 'Failed to process subscription' });
    }
  }

  // Handle subscription events
  if (event.type === 'customer.subscription.created' || 
      event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;
    
    // Get customer email
    const customer = await stripe.customers.retrieve(subscription.customer as string);
    const email = typeof customer === 'object' && !customer.deleted 
      ? customer.email 
      : null;

    if (!email) {
      console.error('No email found for customer');
      return res.status(400).json({ error: 'No email for customer' });
    }

    try {
      await createSubscriptionRecord({
        email,
        stripeCustomerId: subscription.customer as string,
        stripeSubscriptionId: subscription.id,
        planName: subscription.metadata?.plan || 'starter',
        status: subscription.status,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      });

      console.log(`✅ Subscription ${subscription.id} processed for ${email}`);
    } catch (error) {
      console.error('Error processing subscription:', error);
      return res.status(500).json({ error: 'Failed to process subscription' });
    }
  }

  res.json({ received: true });
});
```

### Client-Side Success Page Handler

```typescript
// On your Stripe checkout success page
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('session_id');
  
  if (sessionId) {
    // Fetch session details from your backend
    fetch(`/api/stripe/session/${sessionId}`)
      .then(res => res.json())
      .then(async (session) => {
        const email = session.customer_email || session.customer_details?.email;
        
        if (email) {
          // Create subscription record via your API
          await fetch('/api/subscriptions/create', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email,
              stripeCustomerId: session.customer,
              stripeSubscriptionId: session.subscription,
              planName: session.metadata?.plan || 'starter',
              status: 'active',
            }),
          });
          
          // Redirect to onboarding
          window.location.href = `/onboarding/setup-account?email=${encodeURIComponent(email)}`;
        }
      })
      .catch(error => {
        console.error('Error processing subscription:', error);
        // Still redirect to onboarding - they can enter email manually
        window.location.href = '/onboarding/setup-account';
      });
  }
}, []);
```

## Status Values

Use these status values from Stripe:
- `pending` - Initial state, payment processing
- `active` - Subscription is active and paid
- `trialing` - In trial period
- `past_due` - Payment failed but subscription still active
- `canceled` - Subscription cancelled
- `unpaid` - Payment failed, subscription inactive

## Plan Names

Use consistent plan identifiers:
- `starter` - Basic plan
- `professional` - Mid-tier plan
- `enterprise` - Premium plan

Or use your own naming convention, but be consistent.

## Error Handling

### Important Considerations:

1. **Idempotency**: Check if subscription already exists before inserting to avoid duplicates
2. **Email Validation**: Always validate email format before inserting
3. **Transaction Safety**: Use database transactions to ensure data consistency
4. **Error Logging**: Log all errors for debugging
5. **Graceful Degradation**: If database insert fails, still allow user to proceed (they can enter email manually on onboarding page)

### Error Handling Example:

```typescript
try {
  await createSubscriptionRecord(stripeData);
} catch (error) {
  console.error('Failed to create subscription record:', error);
  
  // Log error but don't block user flow
  // They can still access onboarding page and enter email manually
  // The system will verify subscription when they submit the form
  
  // Optionally send to error tracking service (Sentry, etc.)
  // reportError(error);
}
```

## Security Best Practices

1. **Environment Variables**: Never commit database credentials to version control
2. **Connection Pooling**: Use connection pooling to manage database connections efficiently
3. **Input Validation**: Always validate and sanitize email addresses
4. **SQL Injection**: Use parameterized queries (as shown in examples)
5. **Error Messages**: Don't expose database errors to end users
6. **Rate Limiting**: Implement rate limiting on subscription creation endpoints

## Testing Checklist

- [ ] Database connection works with provided credentials
- [ ] Subscription record created successfully after Stripe payment
- [ ] Duplicate email handling works (updates existing record)
- [ ] Redirect to onboarding page with email parameter works
- [ ] Onboarding page can verify subscription by email
- [ ] Account creation works from onboarding page
- [ ] Error handling works gracefully

## Onboarding Page URL

The onboarding page is available at:
```
https://your-app-domain.com/onboarding/setup-account
```

With optional email parameter:
```
https://your-app-domain.com/onboarding/setup-account?email=customer@example.com
```

## Support

If you encounter issues:
1. Check database connection string format
2. Verify environment variables are set correctly
3. Check database logs for connection errors
4. Ensure the `subscriptions` table exists (migration 0020 should have created it)
5. Verify email is being extracted correctly from Stripe session

## Summary

**What you need to do:**
1. ✅ Set up database connection using `DATABASE_URL` or individual `PG*` environment variables
2. ✅ After successful Stripe payment, extract customer email and subscription details
3. ✅ Insert/update record in `subscriptions` table with required fields
4. ✅ Redirect user to `/onboarding/setup-account?email={customerEmail}`
5. ✅ Handle errors gracefully - user can still access onboarding page manually

**Required fields to populate:**
- `email` (REQUIRED)
- `status` (REQUIRED, default: 'pending')
- `stripe_customer_id` (RECOMMENDED)
- `stripe_subscription_id` (RECOMMENDED if using subscriptions)
- `plan_name` (RECOMMENDED)
- `current_period_start` and `current_period_end` (RECOMMENDED if available)

**Leave NULL:**
- `business_id` (populated automatically after account creation)
- `account_created` (set automatically, default: false)


