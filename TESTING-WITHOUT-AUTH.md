# Testing Without Auth - Quick Setup

## For Local Development Testing

You have two options to test the API without needing auth tokens:

### Option 1: Use Service Role Key (Recommended for Testing)

Update your `.env.local` file to temporarily use the service role key:

```env
# Add this line - get the service role key from Supabase dashboard
NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

⚠️ **NEVER commit this to git!** The service role key bypasses all security.

Then modify your API routes to use the service role client for testing.

### Option 2: Disable RLS Temporarily (For Testing Only)

In your Supabase dashboard, you can temporarily disable RLS on the AMS tables:

1. Go to SQL Editor
2. Run this query:

```sql
-- TEMPORARY: Disable RLS for testing (REMOVE BEFORE PRODUCTION!)
ALTER TABLE resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs DISABLE ROW LEVEL SECURITY;
```

**After testing, ENABLE RLS again:**

```sql
-- Re-enable RLS after testing
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
```

### Option 3: Test with Auth (Proper Approach)

If you want to test with proper authentication:

1. **Get a test user token:**
   ```javascript
   // In your app, after logging in, you can get the token:
   const { data: { session } } = await supabase.auth.getSession()
   console.log('Token:', session.access_token)
   ```

2. **Then use it in Postman:**
   - Header: `Authorization: Bearer YOUR_TOKEN_HERE`

3. **Or test directly in the app** using the UI instead of Postman.

## Quick Test Command

You can also test the API using curl:

```bash
# Test GET (should work without auth if RLS is disabled or using service role)
curl http://localhost:3000/api/resources

# Test POST (create a resource)
curl -X POST http://localhost:3000/api/resources \
  -H "Content-Type: application/json" \
  -d '{
    "resource_id": "Test001",
    "resource_name": "Test Resource",
    "resource_type": "Equipment",
    "description": "Testing",
    "condition": "Good",
    "is_available": true
  }'
```

## Recommended: Test Through the App UI

Instead of Postman, you can test through the actual app UI:

1. Start the dev server: `npm run dev`
2. Navigate to the relevant pages in your app
3. Create resources, bookings, etc. through the UI

This ensures proper authentication flows are working correctly.

