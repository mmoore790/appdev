# Domain Setup Guide: app.boltdown.co.uk

After connecting your custom domain `app.boltdown.co.uk` to Vercel, you need to update environment variables in both Vercel and Render.

## Required Updates

### 1. Vercel Environment Variables (Frontend)

You need to set the API base URL so your frontend can connect to your Render backend.

**Environment Variable to Add:**
- **Name:** `VITE_API_BASE_URL`
- **Value:** Your Render backend URL (e.g., `https://your-app.onrender.com`)

**How to add:**
1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add:
   - Variable: `VITE_API_BASE_URL`
   - Value: `https://your-backend-url.onrender.com` (replace with your actual Render URL)
   - Environment: Production (and Preview if needed)
4. **Redeploy** your Vercel app after adding the variable

**Note:** If you don't set this, the frontend will try to use relative URLs which won't work for cross-origin requests to Render.

---

### 2. Render Environment Variables (Backend)

You need to allow CORS requests from your new domain.

**Environment Variables to Add/Update:**
- **Name:** `CORS_ORIGIN` OR `FRONTEND_URL`
- **Value:** `https://app.boltdown.co.uk`

**How to add:**
1. Go to your Render dashboard
2. Select your backend service
3. Navigate to **Environment** tab
4. Add or update:
   - Variable: `CORS_ORIGIN` (or `FRONTEND_URL`)
   - Value: `https://app.boltdown.co.uk`
   - You can also include multiple origins separated by commas if needed:
     ```
     https://app.boltdown.co.uk,https://your-app.vercel.app
     ```
5. **Redeploy** your Render service after updating

**Note:** The backend currently defaults to localhost origins if these variables aren't set, which will block requests from your production domain.

---

### 3. Stripe Payment URLs (Backend)

If you're using Stripe payments, you should also update the Stripe service to use your new domain.

**Environment Variable to Add:**
- **Name:** `FRONTEND_DOMAIN` (preferred) OR `FRONTEND_URL`
- **Value:** `app.boltdown.co.uk` (just the domain, no protocol)

**How to add:**
1. Go to your Render dashboard
2. Select your backend service
3. Navigate to **Environment** tab
4. Add:
   - Variable: `FRONTEND_DOMAIN`
   - Value: `app.boltdown.co.uk`
5. **Redeploy** your Render service

**Note:** The code has been updated to check for `FRONTEND_DOMAIN` first, then `FRONTEND_URL` (strips protocol if present), then falls back to `REPLIT_DOMAINS` for backward compatibility. If you already have `FRONTEND_URL` set with the full URL (`https://app.boltdown.co.uk`), that will work too.

---

## Summary Checklist

### Vercel (Frontend)
- [ ] Add `VITE_API_BASE_URL` environment variable pointing to your Render backend URL
- [ ] Redeploy the frontend

### Render (Backend)
- [ ] Add `CORS_ORIGIN` or `FRONTEND_URL` environment variable with value `https://app.boltdown.co.uk`
- [ ] (If using Stripe) Add `FRONTEND_DOMAIN` environment variable with value `app.boltdown.co.uk`
- [ ] Redeploy the backend service

---

## Testing After Updates

1. **Test CORS:** Open your browser console on `https://app.boltdown.co.uk` and check for CORS errors
2. **Test API Connection:** Try logging in or making an API request
3. **Test Payments:** If using Stripe, test that payment redirects work correctly

---

## Troubleshooting

### CORS Errors
- Verify `CORS_ORIGIN` or `FRONTEND_URL` is set correctly in Render
- Make sure the value includes the protocol (`https://`)
- Check Render logs for CORS warnings
- You can temporarily enable `DEBUG_CORS=true` in Render to see allowed origins in logs

### API Connection Errors
- Verify `VITE_API_BASE_URL` is set correctly in Vercel
- Make sure the Render backend URL is correct and accessible
- Check browser network tab to see what URL is being called

### Session/Cookie Issues
- The backend is already configured with `sameSite: 'none'` and `secure: true` for cross-origin cookies
- If sessions aren't working, check that cookies are being set in the browser

