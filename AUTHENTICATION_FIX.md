# Authentication Fix - Frontend

## Changes Made

### 1. Updated Auth0 Scopes
**File**: `src/config/auth.config.ts`
- Added scopes: `read:properties write:properties read:bookings write:bookings`
- Ensures token includes necessary permissions for API access

### 2. Updated Token Getter
**File**: `src/hooks/use-auth.ts`
- Updated `getAccessTokenSilently` calls to include extended scopes
- Ensures consistent scope requests across the application

### 3. Improved Request Interceptor
**File**: `src/lib/axios.ts`
- Added skip logic for public endpoints (`/health`, `/auth/`)
- Improved error logging for authentication issues
- Better detection of login_required errors

### 4. Enhanced Response Interceptor
**File**: `src/lib/axios.ts`
- Added specific handling for 400 Bad Request errors
- Improved logging for debugging authentication issues

## Testing Instructions

### Step 1: Ensure Backend is Running
```bash
cd C:\Users\luca.la-malfa\private-project\casazen\backend
dotnet run --project Casazen.Web
```
Backend should be running on: http://localhost:5000

### Step 2: Ensure Frontend is Running
```bash
cd C:\Users\luca.la-malfa\private-project\casazen\frontend
npm run dev
```
Frontend should be running on: http://localhost:5174

### Step 3: Test Authentication Flow

1. **Open Browser**: Navigate to http://localhost:5174
2. **Login**: You should be redirected to Auth0 login
   - Use your Auth0 credentials
   - Or create a new account
3. **Check Console**: After login, open browser DevTools (F12) and check console
   - Look for: `[Auth Debug] Token obtained successfully`
   - Look for: `[Auth Debug] Token audience: https://casazen-api`
   - Look for: `[Auth Debug] Token scopes: ...`

### Step 4: Test Property Creation

1. **Navigate to Properties**: Click "Properties" in navigation
2. **Create Property**: Click "Create Property" button
3. **Fill Form**: Enter property details:
   - Name: Test Property
   - Address: Via Roma 1
   - City: Milano
   - Bedrooms: 2
   - Bathrooms: 1
   - Max Guests: 4
   - Nightly Rate: 100
4. **Submit**: Click Save/Create
5. **Check Console**: Look for:
   - `[Auth Debug] Authorization header set: Bearer ...`
   - Successful POST request (status 201)

### Step 5: Verify Token in Network Tab

1. **Open DevTools**: Press F12
2. **Network Tab**: Click "Network" tab
3. **Make Request**: Try creating/updating a property
4. **Inspect Request**: Click on the request in Network tab
5. **Check Headers**: Under "Request Headers", verify:
   ```
   Authorization: Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Expected Results

### ✅ Success Indicators
- User successfully logs in via Auth0
- Console shows `[Auth Debug] Token obtained successfully`
- POST /api/properties returns 201 Created
- Property appears in properties list
- No 400 or 401 errors in console

### ❌ Failure Indicators
- 401 Unauthorized errors → User not logged in or token invalid
- 400 Bad Request with "No sub claim" → Token doesn't have correct audience
- `[Auth Debug] No token available` → Token getter not configured
- `login_required` error → User needs to login

## Troubleshooting

### Issue: "No token available"
**Solution**: 
- Ensure user is logged in
- Check console for Auth0 errors
- Clear localStorage and login again

### Issue: "Token doesn't have correct audience"
**Solution**:
- Verify .env has `VITE_AUTH0_AUDIENCE=https://casazen-api`
- Logout and login again to get new token with correct audience
- Check Auth0 dashboard API configuration

### Issue: "Invalid token" or 401 errors
**Solution**:
- Check backend logs for auth errors
- Verify Auth0 domain and client ID match in frontend and backend
- Ensure backend `appsettings.Development.json` has correct Auth0 config

### Issue: CORS errors
**Solution**:
- Verify backend CORS allows http://localhost:5174
- Check `Casazen.Web/Extensions/ServiceCollectionExtensions.cs` line 126

## Next Steps

After testing frontend authentication:

1. ✅ **Re-enable Backend Authorization**
   - Uncomment `[Authorize]` in PropertiesController.cs
   - Uncomment `[Authorize]` in BookingsController.cs
   - Re-enable `ValidateAudience = true` in ServiceCollectionExtensions.cs

2. ✅ **Test All Endpoints**
   - Properties CRUD
   - Bookings CRUD
   - Guests CRUD
   - Payments
   - OTA Integrations

3. ✅ **Remove Debug Logging**
   - Remove console.log statements from production builds
   - Keep error logging for monitoring

## Environment Variables Required

```env
VITE_AUTH0_DOMAIN=dev-mp6wadq7j6bophl5.us.auth0.com
VITE_AUTH0_CLIENT_ID=xmZPesTR04r349c14n77MgJ2iSCeFaJb
VITE_AUTH0_AUDIENCE=https://casazen-api
VITE_API_BASE_URL=http://localhost:5000/api
VITE_DEMO_MODE=false
```

## Related GitHub Issues

- casazen/backend#95 - Authentication completely broken
- casazen/backend#99 - Property endpoints failing
- casazen/backend#105 - EPIC: Complete authentication integration
- casazen/frontend#40 - Frontend not sending Authorization header

---

**Last Updated**: 2026-05-02
**Status**: ✅ FIXED - Ready for testing
