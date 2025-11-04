# Quick Test Card - Drag & Drop Debugging

## ✅ Backend Status: WORKING
The backend endpoint is confirmed working. Issue is on **frontend**.

---

## 🎯 What You Need to Do RIGHT NOW

### 1. Open Website
```
http://localhost:3001
```

### 2. Open Browser Console (F12)
- Click Console tab
- Keep it open

### 3. Activate Edit Mode
```
1. Go to: http://localhost:3000
2. Login: systemadmin / SystemAdmin123!
3. Navigate to any project
4. Click "View in CMS" button
5. Should redirect to website with edit mode active
```

### 4. Check These Values
Run in console:
```javascript
// Check auth state
console.log('Token:', localStorage.getItem('cms_auth_token') ? 'EXISTS' : 'MISSING');
console.log('Edit Mode:', localStorage.getItem('cms_edit_mode'));

// Or all at once:
console.log({
  token: !!localStorage.getItem('cms_auth_token'),
  editMode: localStorage.getItem('cms_edit_mode'),
  tokenPreview: localStorage.getItem('cms_auth_token')?.substring(0, 30)
});
```

### 5. Drag a Section
- Drag any section to a new position
- **Watch the console output**

---

## 🔍 What Console Should Show

### If Working Correctly:
```
🎯 === PROJECT SECTION DRAG END TRIGGERED ===
🔍 Context: { isEditMode: true, hasToken: true, projectId: 9 }
🔐 Checking save conditions: { willSave: true }
[REORDER] Sending request to backend...
✅ Reorder API response
Successfully saved project sections order to backend
```

### If NOT in Edit Mode:
```
🎯 === PROJECT SECTION DRAG END TRIGGERED ===
🔍 Context: { isEditMode: false, hasToken: false, ... }
🔐 Checking save conditions: { willSave: false }
⚠️ === BACKEND SAVE SKIPPED ===
❌ One or more conditions failed
```

---

## 📸 What to Share with Me

Copy and paste these from your browser:

### 1. Console Output
```
(Select all console output after drag operation and copy)
```

### 2. Network Tab
```
F12 → Network tab → Filter: Fetch/XHR
Drag section
Screenshot or copy any requests to:
  .../sections/order
```

### 3. Auth Status
```javascript
// Run this in console and copy output:
console.log({
  token: !!localStorage.getItem('cms_auth_token'),
  tokenValue: localStorage.getItem('cms_auth_token'),
  editMode: localStorage.getItem('cms_edit_mode'),
  user: localStorage.getItem('cms_user')
});
```

### 4. Notification
- Did you see a notification popup?
- What did it say?
- Color: Green (success), Yellow (warning), or Red (error)?

---

## 🚨 Common Issues & Quick Fixes

### "Token: MISSING"
**Fix:** You're not in edit mode
1. Go to backend admin (http://localhost:3000)
2. Click "View in CMS" button

### "isEditMode: false"
**Fix:** Edit mode not activated
1. Look for `?token=XXX&edit=true` in URL
2. If missing, use "View in CMS" button from admin

### "No network request appears"
**Possible causes:**
- isEditMode is false
- Token is missing
- JavaScript error before API call
- Check console for errors

### "401 Unauthorized"
**Fix:** Token expired
1. Re-authenticate via admin "View in CMS"

---

## ⚡ Super Quick Debug

**One-liner to check everything:**
```javascript
(function() {
  const token = localStorage.getItem('cms_auth_token');
  const editMode = localStorage.getItem('cms_edit_mode');
  console.log('===== QUICK STATUS CHECK =====');
  console.log('✅ Has Token:', !!token);
  console.log('✅ Edit Mode:', editMode);
  console.log('✅ Token Preview:', token?.substring(0, 30) + '...');
  console.log('==============================');
})();
```

---

## 📖 Full Documentation

- **Detailed Guide:** See `FRONTEND_DRAG_DROP_DEBUG.md`
- **Investigation:** See `DRAG_DROP_ISSUE_RESOLUTION.md`

---

## 🎯 Expected Result

When drag & drop works:
- ✅ Drag section → Immediate visual update
- ✅ Console shows successful API call
- ✅ Green notification: "Section Order Updated"
- ✅ Order persists after refresh
- ✅ Network tab shows `200 OK` response

---

**Status:** Waiting for you to test with browser console open!
