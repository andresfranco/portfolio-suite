# Quick Start Guide - Phase 2 Testing

## 🚀 Quick Start

### 1. Backend Setup (Terminal 1)
```bash
cd /home/andres/projects/portfolio-suite/portfolio-backend
source venv/bin/activate
python run.py
```

Backend should start on: http://localhost:8000

### 2. Website Setup (Terminal 2)
```bash
cd /home/andres/projects/portfolio-suite/website

# First time only: Create .env file
cp .env.example .env
# Edit .env and ensure: REACT_APP_API_URL=http://localhost:8000

# Install dependencies (if not done)
npm install

# Start the website
npm start
```

Website should open at: http://localhost:3000

---

## ✅ Quick Tests

1. **Homepage loads** - Should see experiences from database
2. **Projects page** - Navigate to /projects, should see projects from API
3. **Language switch** - Change language, content should update
4. **Project details** - Click on a project, should see full details
5. **Experience details** - Click on an experience card, should see details

---

## 🐛 Troubleshooting

### "Loading..." never goes away
- Check backend is running on port 8000
- Check browser console for API errors
- Verify .env file has correct REACT_APP_API_URL

### No data showing
```sql
-- Check if default portfolio exists
SELECT * FROM portfolios WHERE is_default = TRUE;

-- If none, set one as default
UPDATE portfolios SET is_default = TRUE WHERE id = 1;
```

### Images not showing
- Check if project images exist in database
- Verify image paths are correct
- Check browser console for 404 errors on image URLs

### CORS errors
- Backend should have CORS configured for http://localhost:3000
- Check backend logs for CORS errors

---

## 📊 Verify API Responses

Open browser DevTools (F12) → Network tab:

1. Should see: `GET /api/website/default?language_code=en`
2. Response Status: 200 OK
3. Response Body: JSON with portfolio data

---

## 🎯 What to Test Next

After Phase 2 is verified, Phase 3 will add:
- Login functionality
- Edit mode toggle
- Inline editing components
- Permission checks

Phase 2 focuses on **viewing** content from API. Phase 3 will add **editing** capabilities.
