// Test script to simulate a Stripe webhook event
const http = require('http');

// Simulate a checkout.session.completed event
const webhookEvent = {
  type: 'checkout.session.completed',
  data: {
    object: {
      id: 'cs_test_example123',
      payment_intent: 'pi_test_example123',
      payment_status: 'paid',
      amount_total: 5000, // £50.00 in pence
      metadata: {}
    }
  }
};

const postData = JSON.stringify(webhookEvent);

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/stripe/webhook',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': postData.length
  }
};

console.log('Sending test webhook event to /api/stripe/webhook...');
console.log('Event data:', JSON.stringify(webhookEvent, null, 2));

const req = http.request(options, (res) => {
  console.log(`STATUS: ${res.statusCode}`);
  console.log(`HEADERS: ${JSON.stringify(res.headers)}`);
  res.setEncoding('utf8');
  res.on('data', (chunk) => {
    console.log(`BODY: ${chunk}`);
  });
  res.on('end', () => {
    console.log('Webhook test completed');
  });
});

req.on('error', (e) => {
  console.error(`problem with request: ${e.message}`);
});

req.write(postData);
req.end();