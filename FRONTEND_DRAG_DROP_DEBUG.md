# Frontend Drag & Drop Debugging Guide

## ✅ Backend Verification Complete

**CONFIRMED:** The backend endpoint is working correctly!

### Test Results:
```
URL: http://localhost:8000/api/cms/content/project/9/sections/order
Method: PATCH
Status: 200 OK
Response: {"message": "Successfully reordered 0 section(s)", "reordered_count": 0}
```

The backend:
- ✅ Accepts the requests properly
- ✅ Authentication works with session cookies
- ✅ CSRF validation passes
- ✅ Returns 200 OK status

**Conclusion:** The issue is on the FRONTEND side - the drag event is not triggering the API call.

---

## 🔍 Frontend Debugging Checklist

### Step 1: Verify Edit Mode is Active

1. Open the website: `http://localhost:3001`
2. Open browser console (F12 → Console tab)
3. Check if you see these logs when the page loads:
   ```
   EditMode loaded with token: <token>
   Edit mode is: true
   User permissions: <permissions>
   ```

**If NOT in edit mode:**
- Go to backend admin UI: `http://localhost:3000`
- Login as systemadmin
- Navigate to the project
- Click "View in CMS" button
- This should redirect to website with `?token=XXX&edit=true` in URL

### Step 2: Check Authentication Token

In browser console, run:
```javascript
localStorage.getItem('cms_auth_token')
```

**Expected:** Should return a JWT token string
**If null:** Edit mode was not properly activated. Repeat Step 1.

### Step 3: Monitor Network Requests During Drag

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Filter by "Fetch/XHR"
4. **Drag a section** to a new position
5. Look for a PATCH request to `/api/cms/content/project/9/sections/order`

**Scenarios:**

#### A) No Network Request Appears
**Problem:** The drag event handler is not triggering the API call

**Possible causes:**
- `isEditMode` is false
- Drag event not properly detected
- JavaScript error preventing execution

**Debug actions:**
```javascript
// Check in console during drag:
console.log('Is Edit Mode:', isEditMode);
console.log('Project:', project);
console.log('Sections:', projectSections);
```

Add temporary log in `ProjectDetails.js` at line 140:
```javascript
const handleProjectSectionsDragEnd = async (result) => {
  console.log('🎯 DRAG END TRIGGERED', {
    isEditMode,
    result,
    hasToken: !!localStorage.getItem('cms_auth_token')
  });
  
  // Rest of existing code...
}
```

#### B) Request Appears with 401/403 Status
**Problem:** Authentication or permissions issue

**Debug actions:**
- Check request headers include: `Authorization: Bearer <token>`
- Verify token is valid (not expired)
- Check user has EDIT_CONTENT permission

#### C) Request Appears with 422/400 Status
**Problem:** Invalid request data

**Debug actions:**
- Check request payload format:
  ```json
  {
    "section_ids": [89, 91]
  }
  ```
- Verify section IDs are numbers, not strings

#### D) Request Appears with 200 OK but Nothing Changes
**Problem:** API succeeds but frontend doesn't refresh

**Check:**
- Does `refreshPortfolio()` get called after success?
- Check console for "Successfully reordered" message
- Check if `reordered_count > 0` in response

### Step 4: Check Console for Errors

Look for any JavaScript errors:
- Red error messages
- Failed API calls
- React rendering errors

Common issues:
```
- TypeError: Cannot read property 'X' of undefined
- Network request failed
- CORS errors
- 401 Unauthorized
```

### Step 5: Verify Drag Library

Check if `@hello-pangea/dnd` is properly working:

```javascript
// In console:
document.querySelector('[data-rbd-droppable-id]')
```

**Expected:** Should return the droppable container
**If null:** Drag library not initialized

### Step 6: Check Component State

Add debug logging in `ProjectDetails.js`:

```javascript
// After line 45 (in useEffect):
console.log('📊 PROJECT SECTIONS STATE', {
  rawSections: project?.sections?.length,
  sortedSections: projectSections.length,
  sections: projectSections.map(s => ({
    id: s.id,
    code: s.code,
    display_order: s.display_order
  }))
});
```

This will show if sections are loading correctly.

---

## 🐛 Most Likely Issues (Based on Testing)

### Issue #1: Drag Event Not Firing API Call

**Symptoms:**
- No network request when dragging
- Console logs work but API call doesn't happen

**Check in `ProjectDetails.js` line 140-178:**

```javascript
const handleProjectSectionsDragEnd = async (result) => {
  console.log('🔥 START handleProjectSectionsDragEnd'); // ADD THIS
  
  if (!isEditMode) {
    console.log('⚠️ Not in edit mode, aborting'); // ADD THIS
    return;
  }
  
  if (!result.destination) {
    console.log('⚠️ No destination, aborting'); // ADD THIS
    return;
  }
  
  console.log('📤 About to call reorderProjectSections'); // ADD THIS
  
  // ... existing code
```

### Issue #2: Auth Token Not Included

**Check `portfolioApi.js` line 423-451:**

The `reorderProjectSections` function should have extensive logging.
Look for these console logs:
```
📤 reorderProjectSections called
📋 Request body:
🌐 Making API call
✅ Reorder API response
```

**If missing:** The function might not be getting called at all.

### Issue #3: Silent Failure

**Check for `try-catch` blocks swallowing errors:**

In `ProjectDetails.js`, make sure errors are logged:
```javascript
} catch (error) {
  console.error('❌ Reorder error:', error); // Make sure this exists
  showNotification('Error', 'Failed to reorder sections', 'error');
}
```

---

## 🎯 Immediate Action Plan

**Right now, please do this:**

1. Open website in browser: `http://localhost:3001`
2. Open Console (F12)
3. **Activate edit mode** (via backend admin "View in CMS" button)
4. **Drag a section** to new position
5. **Copy ALL console output** and share it
6. Also open **Network tab** and check if PATCH request appears

**Share with me:**
```
✅ Console logs (full output)
✅ Network tab screenshot/log
✅ Any error messages
✅ Value of: localStorage.getItem('cms_auth_token')
✅ Value of: isEditMode (from console or React DevTools)
```

---

## 📝 Quick Console Debug Commands

Run these in browser console while on the project detail page:

```javascript
// Check auth state
console.log({
  token: !!localStorage.getItem('cms_auth_token'),
  editMode: localStorage.getItem('cms_edit_mode'),
  user: localStorage.getItem('cms_user')
});

// Check if reorder function exists
console.log('reorderProjectSections exists:', typeof window.portfolioApi?.reorderProjectSections);

// Check project state (if using React DevTools)
// Look for ProjectDetails component and inspect its state
```

---

## ✨ Expected Working Behavior

When drag & drop works correctly, you should see:

**Console output:**
```
🎯 DRAG END TRIGGERED { isEditMode: true, result: {...}, hasToken: true }
📤 reorderProjectSections called
📋 Request body: {"section_ids":[91,89]}
🌐 Making API call to: /api/cms/content/project/9/sections/order
✅ Reorder API response { reordered_count: 2 }
Successfully reordered 2 sections
```

**Network tab:**
```
Request URL: http://localhost:8000/api/cms/content/project/9/sections/order
Request Method: PATCH
Status Code: 200 OK
Response: {"message":"Successfully reordered 2 section(s)","reordered_count":2}
```

**UI:**
- Success notification appears
- Sections visually reorder
- Order persists on page refresh

---

## 🔧 If Still Not Working

If after all the above the issue persists, we may need to:

1. **Add temporary debug button** to manually trigger reorder
2. **Simplify the drag handler** to isolate the issue
3. **Check for conflicting event listeners**
4. **Verify React state updates** are not being prevented

Let me know what you find and we'll continue from there!
