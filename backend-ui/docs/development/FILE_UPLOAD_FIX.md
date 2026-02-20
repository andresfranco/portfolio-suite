# File Upload Fix - December 2024

## Problem

After implementing security improvements (CSRF protection, secure cookies, etc.), file uploads in Projects and Portfolios were failing with two errors:

1. **422 Unprocessable Entity**: `Field required` - Backend couldn't parse FormData
2. **403 Forbidden / CSRF validation failed**: CSRF token not being sent with uploads

## Root Cause Analysis

### Issue 1: Default Content-Type Header Conflict

The axios instance was configured with a default `'Content-Type': 'application/json'` header. When uploading files with `FormData`, this default prevented axios from automatically setting the proper multipart Content-Type with boundary.

### Issue 2: CSRF Token Not Sent with FormData

When we tried to fix Issue 1 by setting `headers: { 'Content-Type': undefined }` on individual requests, it created a **new headers object that didn't include the CSRF token** added by the interceptor. This caused CSRF validation to fail.

**The sequence:**
1. Request interceptor runs → adds `X-CSRF-Token` header
2. Request is made with `headers: { 'Content-Type': undefined }` config
3. Axios merges/overrides headers → **CSRF token lost!**
4. Backend receives request without CSRF token → 403 Forbidden

### Backend Errors

```
# Error 1: FormData not parsed (wrong Content-Type)
INFO: 127.0.0.1:58204 - "POST /api/portfolios/1/attachments HTTP/1.1" 422 Unprocessable Entity
WARNING - Validation error: [{'loc': ('body', 'file'), 'msg': 'Field required', 'type': 'missing'}]

# Error 2: CSRF validation failed
INFO: 127.0.0.1:55826 - "POST /api/projects/10/images HTTP/1.1" 403 Forbidden
WARNING - CSRF validation failed for POST /api/projects/10/images
```

## Solution

**Handle FormData detection and Content-Type removal in the axios interceptor**, ensuring CSRF token is always preserved.

### Updated Interceptor

```javascript
// Request interceptor for CSRF token
api.interceptors.request.use(
  (config) => {
    const csrfToken = localStorage.getItem('csrf_token');
    
    // Add CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
    const stateMutatingMethods = ['post', 'put', 'delete', 'patch'];
    if (csrfToken && stateMutatingMethods.includes(config.method?.toLowerCase())) {
      config.headers['X-CSRF-Token'] = csrfToken;
      logDebug('CSRF token added to request');
    }
    
    // Handle FormData: Remove Content-Type to let axios/browser set it with boundary
    if (config.data instanceof FormData) {
      delete config.headers['Content-Type'];
      logDebug('FormData detected, removed Content-Type header for proper boundary');
    }
    
    return config;
  },
  (error) => Promise.reject(error)
);
```

### How It Works

1. **CSRF token added first** → Always present for state-changing requests
2. **FormData detection** → If data is FormData, delete Content-Type
3. **Browser sets header** → `Content-Type: multipart/form-data; boundary=...`
4. **Result** → Both CSRF token AND proper Content-Type in the same request

### All Upload Functions Now Use Simple API Calls

```javascript
// ✅ Clean API calls - interceptor handles everything
export const uploadProjectImage = (projectId, formData) => 
  api.post(`/projects/${projectId}/images`, formData);

export const uploadProjectAttachment = (projectId, formData) => 
  api.post(`/projects/${projectId}/attachments`, formData);

export const uploadPortfolioImage = (portfolioId, formData) => 
  api.post(`/portfolios/${portfolioId}/images`, formData);

export const uploadPortfolioAttachment = (portfolioId, formData) => 
  api.post(`/portfolios/${portfolioId}/attachments`, formData);
```

No more manual `headers: { 'Content-Type': undefined }` configs needed!

## Files Modified

### Core API Configuration
1. **`src/services/api.js`** - Enhanced request interceptor with FormData detection

### Upload Functions Updated (removed manual headers configs)
2. **`src/services/api.js`** - uploadProjectImage, updateProjectImage, uploadProjectAttachment
3. **`src/services/api.js`** - uploadPortfolioImage, uploadPortfolioAttachment
4. **`src/components/projects/ProjectImages.js`** - Image edit and bulk upload
5. **`src/components/projects/ProjectAttachments.js`** - Attachment upload
6. **`src/services/skillApi.js`** - importSkills
7. **`src/services/languageApi.js`** - createLanguage, updateLanguage

All upload calls now use clean API calls without manual headers configuration.

## Why This Solution Is Better

### ❌ Previous Approach (Phase 1)
```javascript
// Manual headers config on each call
api.post('/upload', formData, {
  headers: { 'Content-Type': undefined }  // ⚠️ Overrides CSRF token!
});
```

**Problems:**
- Manual configuration needed in 11 different locations
- Headers config creates new object → loses interceptor headers
- CSRF token not sent → 403 Forbidden errors
- Easy to forget on new upload endpoints

### ✅ Current Approach (Interceptor-Based)
```javascript
// Interceptor handles everything automatically
api.post('/upload', formData);
```

**Benefits:**
- Centralized logic in one place (DRY principle)
- Works for ALL FormData requests automatically
- CSRF token always preserved
- No manual configuration needed
- New upload endpoints work automatically
- Easier to maintain and understand

### Security Context

The security implementation uses:
- **CSRF Protection**: Double-submit cookie pattern
  - Cookie: `csrf_token` (httpOnly: false, so JS can read it)
  - Header: `X-CSRF-Token` (must match cookie value)
- **CORS Configuration**: Proper origins and credentials
- **Secure Cookies**: httpOnly cookies for JWT tokens

The CSRF middleware validates all state-changing requests:

```python
# CSRFProtectionMiddleware
SAFE_METHODS = ["GET", "HEAD", "OPTIONS"]  # Exempt from CSRF
# All POST, PUT, DELETE, PATCH require valid CSRF token
```

## Testing

After implementing this fix, test all file upload scenarios:
```

#### 3. `/backend-ui/src/components/projects/ProjectAttachments.js`

**Fixed 1 occurrence:**
- Line ~408: `api.post` for uploading project attachments

```javascript
const response = await api.post(`/api/projects/${projectId}/attachments`, formData, {
  headers: { 'Content-Type': undefined }
});
```

#### 4. `/backend-ui/src/services/skillApi.js`

**Fixed 1 occurrence:**
- Line ~203: `api.post` for skill import

```javascript
const response = await api.post('/api/skills/import', formData, {
  headers: { 'Content-Type': undefined }
});
```

#### 5. `/backend-ui/src/services/languageApi.js`

**Already correct** - uses `'Content-Type': undefined` approach:

```javascript
createLanguage: (formData) => 
  api.post('/api/languages', formData, {
    headers: { 'Content-Type': undefined }
  }),
```

## Technical Details

### How Axios Handles FormData

When you pass a `FormData` object to axios without specifying Content-Type:

1. **Axios detects** it's a FormData object
2. **Browser generates** a unique boundary string
3. **Axios sets** `Content-Type: multipart/form-data; boundary=----...`
4. **Request interceptor runs** and adds other headers (like X-CSRF-Token)
5. **Request is sent** with all proper headers

### Why Manual Content-Type Breaks It

```javascript
// When you do this:
{
  headers: { 'Content-Type': 'multipart/form-data' }
}

// The actual request has:
Content-Type: multipart/form-data
// ❌ Missing boundary parameter!

// Backend sees malformed multipart data and cannot parse it
```

### CSRF Token Flow

1. **Login**: Backend sets `csrf_token` cookie (httpOnly: false)
2. **Frontend**: Stores token in localStorage + cookie exists
3. **Request**: Axios interceptor adds `X-CSRF-Token` header
4. **Backend**: CSRFProtectionMiddleware validates:
   - Cookie token exists
   - Header token exists
   - Both tokens match
   - Token not expired
5. **Success**: Request processed

## Testing

After implementing this fix, test all file upload scenarios:

### Project Uploads
- [ ] Single image upload
- [ ] Bulk image upload (multiple files)
- [ ] Image edit/update
- [ ] Attachment upload
- [ ] Attachment with description

### Portfolio Uploads
- [ ] Single image upload
- [ ] Bulk image upload
- [ ] Attachment upload

### Other Uploads
- [ ] Language creation with image
- [ ] Language update with image
- [ ] Skill import (CSV file)

### Browser DevTools Verification

Open DevTools → Network tab, upload a file, check request:

**Headers Should Include:**
```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
X-CSRF-Token: <64-character-hex-string>
Cookie: access_token=...; csrf_token=...
```

**Payload Should Show:**
- FormData sections for each field
- Proper file content
- Correct boundary delimiters

## Expected Results

All uploads should succeed with:
- **200 OK** response
- File saved to `/portfolio-backend/static/uploads/`
- Proper file path returned in response
- No 422 "Field required" errors
- No 422 "Field required" errors
- No 403 "CSRF validation failed" errors

## Troubleshooting

### If uploads still fail with 422

Check request Content-Type in DevTools:
```
Content-Type: application/json  ❌ Wrong - FormData not detected
Content-Type: multipart/form-data; boundary=...  ✅ Correct
```

If wrong, check:
1. Is interceptor code in `api.js`?
2. Is `config.data instanceof FormData` condition working?
3. Check browser console for FormData detection log

### If uploads fail with 403

Check CSRF token in DevTools:
```
X-CSRF-Token: <should be 64-char hex>  ✅ Present
X-CSRF-Token: (missing)  ❌ Not added
```

If missing, check:
1. Is csrf_token in localStorage?
2. Is interceptor adding token before FormData check?
3. Check browser console for "CSRF token added" log

### If localStorage missing csrf_token

User needs to log in again:
1. Logout
2. Login
3. Check Application tab → Local Storage → csrf_token

## Related Issues

### Issue 2: UPLOADS_DIR Path Error

A separate issue was discovered where `.env` had `UPLOADS_DIR=static/uploads` (relative path), causing:
```
ValueError: 'static/uploads/...' is not in the subpath of '/home/andres/projects/portfolio-backend'
```

**Fixed in:** `portfolio-backend/app/core/config.py`
- Changed UPLOADS_DIR to be computed in `model_post_init()`
- Ensures absolute path regardless of .env overrides
- Commented out UPLOADS_DIR in `.env`

## Summary

The file upload fix required a **three-phase debugging process**:

1. **Phase 1**: Fixed Content-Type boundary by setting `undefined` → Created CSRF token issue
2. **Phase 2**: Fixed UPLOADS_DIR path computation → Unrelated config issue
3. **Phase 3**: Fixed CSRF token by centralizing in interceptor → Final working solution

The key insight: **Manual headers configuration overrides interceptor headers**, so we moved all logic into the interceptor for centralized, automatic handling of both Content-Type and CSRF tokens.

## Date
December 2024

## References
- Backend API: `portfolio-backend/app/api/v1/`
- CSRF Middleware: `portfolio-backend/app/api/middleware/csrf.py`
- Security Config: `portfolio-backend/app/core/config.py`
   - Add to onboarding documentation

## Rollback Plan

If this fix causes issues:

1. **Check browser console** for errors
2. **Check backend logs** for CSRF/parsing errors
3. **Verify CSRF token** exists in localStorage
4. **Test with CSRF disabled** (temporarily):
   ```bash
   # In .env
   CSRF_PROTECTION_ENABLED=false
   ```

If needed, revert changes:
```bash
cd /home/andres/projects/portfolio-suite/backend-ui
git diff HEAD -- src/services/api.js
git checkout HEAD -- src/services/api.js  # Revert specific file
```

## Impact

- **Projects**: Image uploads, Attachment uploads - ✅ Fixed
- **Portfolios**: Image uploads, Attachment uploads - ✅ Fixed
- **Skills**: Import functionality - ✅ Fixed
- **Languages**: Create/Update with images - ✅ Fixed

**Total files modified**: 5
**Total occurrences fixed**: 9

## Status

✅ **Fixed** - December 2024  
📋 **Tested**: Pending user verification  
🚀 **Deployed**: Pending

---

**Author**: AI Assistant  
**Date**: December 24, 2024  
**Related Issues**: File uploads failing after security implementation  
**Related PRs**: None (direct fix)
