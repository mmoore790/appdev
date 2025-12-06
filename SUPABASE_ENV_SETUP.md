# Supabase Environment Variables Setup Guide

## Required Environment Variables

Add these to your `backend/.env` file:

### 1. `SUPABASE_STORAGE_BUCKET`
**Where to find it:**
- Go to **Supabase Dashboard** → Your Project
- Click **Storage** in the left sidebar
- **Create a bucket** (if you haven't already):
  - Click **"New bucket"**
  - Name it (e.g., `business-logos`)
  - **Toggle "Public bucket" to ON** (important!)
  - Click **"Create bucket"**
- The bucket name is what you see in the list (e.g., `business-logos`)

**Example:**
```bash
SUPABASE_STORAGE_BUCKET=business-logos
```

---

### 2. `SUPABASE_STORAGE_REGION`
**Where to find it:**
- This is a **placeholder value** (Supabase doesn't use AWS regions)
- Use any value like `us-east-1` (it won't affect Supabase Storage)

**Example:**
```bash
SUPABASE_STORAGE_REGION=us-east-1
```

---

### 3. `SUPABASE_STORAGE_ENDPOINT`
**Where to find it:**
- Go to **Supabase Dashboard** → Your Project
- Click **Settings** (gear icon) → **API**
- Look for **"Project URL"** - it looks like: `https://abcdefghijklmnop.supabase.co`
- The endpoint format is: `https://[YOUR_PROJECT_REF].supabase.co/storage/v1/s3`
- Replace `[YOUR_PROJECT_REF]` with your actual project reference (the part before `.supabase.co`)

**Example:**
```bash
SUPABASE_STORAGE_ENDPOINT=https://akkfrgfqdnvfrenjrqwg.supabase.co/storage/v1/s3
```

---

### 4. `SUPABASE_STORAGE_PUBLIC_BASE_URL`
**Where to find it:**
- Same location as above: **Settings** → **API**
- Use your **Project URL** and format it as: `https://[YOUR_PROJECT_REF].supabase.co/storage/v1/object/public`

**Example:**
```bash
SUPABASE_STORAGE_PUBLIC_BASE_URL=https://akkfrgfqdnvfrenjrqwg.supabase.co/storage/v1/object/public
```

---

### 5. `SUPABASE_STORAGE_ACCESS_KEY_ID`
**Where to find it:**
- Go to **Supabase Dashboard** → Your Project
- Click **Settings** (gear icon) → **API**
- Scroll down to **"Project API keys"**
- Copy the **`anon` `public`** key (the long JWT token starting with `eyJ...`)
- **OR** use the **`service_role` `secret`** key for more security (but keep it secret!)

**Example:**
```bash
SUPABASE_STORAGE_ACCESS_KEY_ID=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2ZyZ2ZxZG52ZnJlbmpycXdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MDc3NzIsImV4cCI6MjA3ODA4Mzc3Mn0.JB7RdCOEzuz2A9g_n8lLpn6tlZeWkAI3RbsJrRUufqw
```

---

### 6. `SUPABASE_STORAGE_SECRET_ACCESS_KEY`
**Where to find it:**
- **Same location** as above: **Settings** → **API** → **Project API keys**
- Use the **same key** as `SUPABASE_STORAGE_ACCESS_KEY_ID` (the `anon` `public` key)
- **OR** use the **`service_role` `secret`** key if you want more security

**Example:**
```bash
SUPABASE_STORAGE_SECRET_ACCESS_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFra2ZyZ2ZxZG52ZnJlbmpycXdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MDc3NzIsImV4cCI6MjA3ODA4Mzc3Mn0.JB7RdCOEzuz2A9g_n8lLpn6tlZeWkAI3RbsJrRUufqw
```

---

### 7. `SUPABASE_STORAGE_PROVIDER` (Optional)
**Default value:** `s3` (you don't need to set this unless you want to change it)

**Example:**
```bash
SUPABASE_STORAGE_PROVIDER=s3
```

---

## Complete Example `.env` File

```bash
# Supabase Storage Configuration
SUPABASE_STORAGE_PROVIDER=s3
SUPABASE_STORAGE_BUCKET=business-logos
SUPABASE_STORAGE_REGION=us-east-1
SUPABASE_STORAGE_ENDPOINT=https://akkfrgfqdnvfrenjrqwg.supabase.co/storage/v1/s3
SUPABASE_STORAGE_PUBLIC_BASE_URL=https://akkfrgfqdnvfrenjrqwg.supabase.co/storage/v1/object/public
SUPABASE_STORAGE_ACCESS_KEY_ID=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_STORAGE_SECRET_ACCESS_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Quick Checklist

- [ ] Created a bucket in Supabase Storage
- [ ] Made the bucket **Public** (toggle in bucket settings)
- [ ] Got Project URL from Settings → API
- [ ] Got API keys from Settings → API (anon public key)
- [ ] Added all 6 variables to `backend/.env`
- [ ] Restarted backend server after adding variables

---

## Important Notes

1. **Bucket must be Public**: For logo uploads to work, your bucket must be set to public. Go to Storage → Your Bucket → Settings → Toggle "Public bucket" ON.

2. **Project Reference**: Your project reference is the part of your Project URL before `.supabase.co`. For example, if your URL is `https://akkfrgfqdnvfrenjrqwg.supabase.co`, your project reference is `akkfrgfqdnvfrenjrqwg`.

3. **API Keys**: The `anon` `public` key is safe to use for public bucket uploads. The `service_role` `secret` key has admin access - use it only if you need more security and keep it secret!

4. **After Changes**: Always restart your backend server after updating environment variables.

