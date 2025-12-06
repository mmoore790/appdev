# Authentication Fix Summary

## Problem
After connecting the custom domain `app.boltdown.co.uk`, all API requests are returning 401 Unauthorized errors, even though login appears to succeed.

## Root Cause
The authentication system uses both session cookies and Bearer tokens. In a cross-origin setup (Vercel frontend → Render backend), session cookies may not work reliably, so the Bearer token fallback is critical. The token might not be:
1. Generated properly by the backend
2. Stored in localStorage by the frontend
3. Sent with subsequent API requests

## Fixes Applied

### 1. Frontend: Always Include Token in API Requests
**File:** `frontend/src/src/lib/api.ts`
- Modified the `request` function to automatically include the Authorization header with the token from localStorage
- This ensures the token is always sent, even if it wasn't explicitly passed

### 2. Frontend: Better Token Logging
**Files:** 
- `frontend/src/src/pages/login.tsx` - Added logging when token is stored
- `frontend/src/src/lib/queryClient.ts` - Added logging when token is sent

### 3. Backend: CORS Configuration
**File:** `backend/src/index.ts`
- Added explicit `allowedHeaders` to include 'Authorization'
- Added `exposedHeaders` to expose 'X-Auth-Token' and 'X-Auth-Success' headers
- This ensures CORS allows the Authorization header and the frontend can read the token header

## Next Steps

### 1. Verify Environment Variables
Make sure you've set these in **Render** (backend):
- `CORS_ORIGIN` or `FRONTEND_URL` = `https://app.boltdown.co.uk`
- `FRONTEND_DOMAIN` = `app.boltdown.co.uk` (for Stripe if using payments)

And in **Vercel** (frontend):
- `VITE_API_BASE_URL` = `https://appdev-x4wz.onrender.com` (your actual Render URL)

### 2. Redeploy Both Services
After setting environment variables:
1. **Redeploy the backend on Render** (to apply CORS changes)
2. **Redeploy the frontend on Vercel** (to apply code changes)

### 3. Test Authentication Flow
1. Open browser DevTools → Network tab
2. Clear localStorage: `localStorage.clear()`
3. Log in at `https://app.boltdown.co.uk/login`
4. Check:
   - **Console logs** - Should see "[Login] Auth token stored in localStorage"
   - **Network tab** - Check the login response headers for `X-Auth-Token`
   - **Application tab** → Local Storage - Should see `authToken` key
   - **Network tab** - Subsequent API requests should have `Authorization: Bearer <token>` header

### 4. Debugging Checklist
If still getting 401 errors:

**Check 1: Is token being generated?**
- Look at Render logs during login
- Should see: "Generated auth token for user X"

**Check 2: Is token being stored?**
- Open browser console
- Type: `localStorage.getItem('authToken')`
- Should return a long hex string

**Check 3: Is token being sent?**
- Open Network tab in DevTools
- Click on any API request
- Check Request Headers
- Should see: `Authorization: Bearer <token>`

**Check 4: Is CORS configured correctly?**
- Check Render logs for CORS warnings
- Should see: "[CORS] Allowed origins: https://app.boltdown.co.uk"

**Check 5: Is backend receiving the token?**
- Check Render logs
- Should see: "User authenticated via token: userId=X" OR "User authenticated via session"

## Known Limitations

### Token Storage is In-Memory
The current token storage uses an in-memory Map, which means:
- Tokens are lost when the backend restarts
- Tokens don't work across multiple backend instances (if Render scales up)

**Workaround:** Users will need to log in again after backend restarts. For production, consider:
- Storing tokens in Redis or database
- Using JWT tokens instead of in-memory storage

## Testing After Fix

1. **Login Test:**
   - Log in successfully
   - Check console for token storage message
   - Check localStorage for `authToken`

2. **API Request Test:**
   - Navigate to dashboard
   - Check Network tab - all requests should have Authorization header
   - Should see data loading (not 401 errors)

3. **Session Test:**
   - Refresh the page
   - Should remain logged in (token persists)

4. **Logout Test:**
   - Log out
   - Token should be removed from localStorage
   - Should redirect to login

## If Issues Persist

1. **Check Render Logs:**
   - Look for authentication errors
   - Check CORS warnings
   - Verify token validation messages

2. **Check Browser Console:**
   - Look for token-related warnings
   - Check for CORS errors
   - Verify API request URLs

3. **Verify Environment Variables:**
   - Double-check all env vars are set correctly
   - Make sure no typos in domain names
   - Ensure URLs include `https://` protocol

4. **Test with curl:**
   ```bash
   # Test login
   curl -X POST https://appdev-x4wz.onrender.com/api/auth/login \
     -H "Content-Type: application/json" \
     -H "Origin: https://app.boltdown.co.uk" \
     -d '{"email":"your-email","password":"your-password"}' \
     -v
   
   # Check response headers for X-Auth-Token
   ```

