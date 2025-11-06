# Stripe Webhook Setup for Automatic Payment Processing

## Overview
The Moore Horticulture system now includes automatic payment processing via Stripe webhooks. When customers complete payments through Stripe checkout sessions, the system automatically marks jobs as paid without requiring manual intervention.

## How It Works

### 1. Payment Request Flow
1. **Staff creates payment request** → Job payment dialog → Send Payment Request
2. **System generates Stripe checkout session** → Creates checkout URL
3. **Customer receives email** → Clicks "Pay Now" button → Redirected to Stripe
4. **Customer completes payment** → Stripe processes payment
5. **Stripe sends webhook** → `POST /api/stripe/webhook` → Job automatically marked as paid

### 2. Webhook Processing
- **Endpoint**: `/api/stripe/webhook` 
- **Events Handled**: 
  - `checkout.session.completed` → Marks job as paid
  - `payment_intent.succeeded` → Logs success
  - `payment_intent.payment_failed` → Marks payment as failed

### 3. Automatic Job Updates
When payment is detected:
- ✅ Payment request status → `paid`
- ✅ Job payment status → `paid`
- ✅ Payment amount → Recorded from Stripe
- ✅ Payment method → `stripe`
- ✅ Payment notes → "Paid via Stripe - Session: [session_id]"
- ✅ Paid timestamp → Current date/time
- ✅ Activity log → Payment completion recorded

## Production Setup

### Required Stripe Configuration
1. **Stripe Dashboard** → Webhooks → Add endpoint
2. **Webhook URL**: `https://your-domain.replit.dev/api/stripe/webhook`
3. **Events to send**:
   - `checkout.session.completed`
   - `payment_intent.succeeded` 
   - `payment_intent.payment_failed`

### Environment Variables
- `STRIPE_SECRET_KEY` → Your Stripe secret key (sk_...)
- `STRIPE_WEBHOOK_SECRET` → Webhook endpoint secret (whsec_...) - Optional for development

### Security Features
- **Signature verification**: Validates webhook authenticity (when STRIPE_WEBHOOK_SECRET is set)
- **Session matching**: Links payments to specific payment requests via checkout session ID
- **Error handling**: Graceful error processing with detailed logging

## Development Testing

### Manual Testing
```bash
# Test webhook endpoint
curl -X POST "http://localhost:5000/api/stripe/webhook" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "checkout.session.completed",
    "data": {
      "object": {
        "id": "cs_test_example123",
        "payment_intent": "pi_test_example123",
        "payment_status": "paid"
      }
    }
  }'
```

### Expected Response
```json
{"received": true}
```

### Check Logs
- Look for: "Payment completed for session: [session_id]"
- If payment request found: Job will be automatically marked as paid
- If no request found: "No payment request found for session [session_id]"

## Benefits

### For Staff
- ✅ **Zero manual work** → Jobs automatically marked as paid
- ✅ **Instant updates** → No need to check Stripe dashboard
- ✅ **Complete audit trail** → All payment details recorded
- ✅ **Error tracking** → Failed payments automatically logged

### For Customers  
- ✅ **Instant confirmation** → Jobs show as paid immediately
- ✅ **Reliable processing** → No payment delays or missed updates
- ✅ **Professional experience** → Seamless payment flow

## Troubleshooting

### Common Issues
1. **Webhook not firing** → Check Stripe dashboard webhook logs
2. **Payment not auto-marked** → Verify session ID matching in payment_requests table
3. **Signature verification failed** → Check STRIPE_WEBHOOK_SECRET value
4. **HTML response instead of JSON** → Ensure webhook endpoint is properly routed

### Monitoring
- Check server logs for webhook processing
- Monitor payment_requests table for status updates
- Verify jobs table payment_status changes
- Review activities table for payment completion logs

## Status: ✅ FULLY OPERATIONAL
- Webhook endpoint: `/api/stripe/webhook` ✅ Working
- Event processing: `checkout.session.completed` ✅ Working
- Job auto-marking: Payment→Job updates ✅ Working
- Activity logging: Payment activities ✅ Working
- Error handling: Graceful failure recovery ✅ Working