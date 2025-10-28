# Language Association for Project Images and Attachments

## Summary

Added language association capability to project images and project attachments, allowing these assets to be associated with specific languages. This enables multi-language support for project-related files, similar to what already exists for portfolio images and attachments.

**Implementation Date:** 2025-10-28

---

## Changes Made

### 1. Database Schema (Migration)

**File:** `portfolio-backend/alembic/versions/d79f10af21da_add_language_id_to_project_images_and_attachments.py`

Added columns:
- `project_images.language_id` (nullable, FK to languages.id)
- `project_attachments.language_id` (nullable, FK to languages.id)
- `project_attachments.category_id` (nullable, FK to categories.id) - *bonus enhancement*

### 2. Backend Models

**File:** `portfolio-backend/app/models/project.py`

- **ProjectImage model:**
  - Added `language_id` column (Integer, ForeignKey)
  - Added `language` relationship to Language model

- **ProjectAttachment model:**
  - Added `language_id` column (Integer, ForeignKey)
  - Added `category_id` column (Integer, ForeignKey)
  - Added `language` relationship to Language model
  - Added `category` relationship to Category model

### 3. Backend Schemas (Pydantic)

**File:** `portfolio-backend/app/schemas/project.py`

- **ProjectImageBase:**
  - Added `language_id: Optional[int] = None`

- **ProjectImageOut:**
  - Added `language: Optional[LanguageResponse] = None`

- **ProjectImageUpdate:**
  - Added `language_id: Optional[int] = None`

- **ProjectAttachmentBase:**
  - Added `category_id: Optional[int] = None`
  - Added `language_id: Optional[int] = None`

- **ProjectAttachmentOut:**
  - Added `category: Optional[CategoryOut] = None`
  - Added `language: Optional[LanguageResponse] = None`

- **ProjectAttachmentUpdate:**
  - Added `category_id: Optional[int] = None`
  - Added `language_id: Optional[int] = None`

### 4. Backend API Endpoints

**File:** `portfolio-backend/app/api/endpoints/projects.py`

- **`upload_project_image()`:**
  - Added `language_id: Optional[int] = Form(None)` parameter
  - Passes `language_id` to CRUD operation

- **`upload_project_attachment()`:**
  - Added `category_id: Optional[int] = Form(None)` parameter
  - Added `language_id: Optional[int] = Form(None)` parameter
  - Passes both parameters to CRUD operation

### 5. Backend CRUD Operations

**File:** `portfolio-backend/app/crud/project.py`

- **`create_project_image()`:**
  - Added `language_id=None` parameter
  - Sets `language_id` on ProjectImage instance

- **`add_project_attachment()`:**
  - Updated ProjectAttachment constructor to include:
    - `category_id=category_id`
    - `language_id=language_id`

### 6. Frontend - ProjectImageForm Component

**File:** `backend-ui/src/components/projects/ProjectImageForm.js`

**Changes:**
1. Added state management for languages:
   ```javascript
   const [languages, setLanguages] = useState([]);
   ```

2. Fetch languages on component mount:
   ```javascript
   const languagesResponse = await api.get('/api/languages');
   setLanguages(languagesResponse.data);
   ```

3. Added `language_id` to `newImage` state:
   ```javascript
   const [newImage, setNewImage] = useState({
     file: null,
     category: '',
     description: '',
     language_id: ''  // NEW
   });
   ```

4. Updated FormData to include language_id:
   ```javascript
   if (newImage.language_id) {
     formData.append('language_id', newImage.language_id);
   }
   ```

5. Added language selector UI after category selector:
   ```jsx
   <FormControl fullWidth>
     <InputLabel id="image-language-label">Language (Optional)</InputLabel>
     <Select
       labelId="image-language-label"
       name="language_id"
       value={newImage.language_id}
       onChange={handleInputChange}
       label="Language (Optional)"
     >
       <MenuItem value=""><em>None (Default)</em></MenuItem>
       {languages.map((language) => (
         <MenuItem key={language.id} value={language.id}>
           {language.name}
         </MenuItem>
       ))}
     </Select>
     <Typography variant="caption" color="text.secondary">
       Select a language if this image is language-specific
     </Typography>
   </FormControl>
   ```

### 7. Frontend - ProjectAttachments Component

**File:** `backend-ui/src/components/projects/ProjectAttachments.js`

**Changes:**
1. Added imports for form controls:
   ```javascript
   import { FormControl, Select, InputLabel, MenuItem } from '@mui/material';
   ```

2. Added state management:
   ```javascript
   const [languages, setLanguages] = useState([]);
   const [categories, setCategories] = useState([]);
   const [loadingLanguages, setLoadingLanguages] = useState(false);
   const [loadingCategories, setLoadingCategories] = useState(false);
   ```

3. Fetch languages and categories on mount:
   ```javascript
   useEffect(() => {
     const fetchLanguagesAndCategories = async () => {
       // Fetch languages
       const languagesResponse = await api.get('/api/languages');
       setLanguages(languagesResponse.data);
       
       // Fetch project attachment categories (type_code='PROA')
       const categoriesResponse = await api.get('/api/categories', {
         params: { 
           type_code: 'PROA',
           page: 1,
           page_size: 100
         }
       });
       // Categories endpoint returns paginated response
       setCategories(categoriesResponse.data.items || []);
     };
     
     fetchLanguagesAndCategories();
   }, []);
   ```

4. Updated file object structure in `processFiles()`:
   ```javascript
   validFiles.push({
     file,
     id: Date.now() + index,
     name: file.name,
     size: file.size,
     type: file.type,
     nameEdited: false,
     language_id: '',    // NEW
     category_id: ''     // NEW
   });
   ```

5. Added handler for metadata changes:
   ```javascript
   const handleFileMetadataChange = (index, field, value) => {
     setSelectedFiles(prev => {
       const newFiles = [...prev];
       newFiles[index] = {
         ...newFiles[index],
         [field]: value
       };
       return newFiles;
     });
   };
   ```

6. Updated FormData to include metadata:
   ```javascript
   if (fileObj.language_id) {
     formData.append('language_id', fileObj.language_id);
   }
   if (fileObj.category_id) {
     formData.append('category_id', fileObj.category_id);
   }
   ```

7. Enhanced upload dialog UI with category and language selectors for each file:
   - Reorganized layout to accommodate additional fields
   - Added category selector (Optional)
   - Added language selector (Optional)
   - Each file in the upload list now has its own selectors

---

## Database Migration Details

**Migration ID:** `d79f10af21da`
**Previous Revision:** `1656f139efd4`

**SQL Operations (Upgrade):**
```sql
-- Add columns to project_images
ALTER TABLE project_images ADD COLUMN language_id INTEGER;
ALTER TABLE project_images ADD CONSTRAINT project_images_language_id_fkey 
  FOREIGN KEY(language_id) REFERENCES languages (id);

-- Add columns to project_attachments
ALTER TABLE project_attachments ADD COLUMN category_id INTEGER;
ALTER TABLE project_attachments ADD COLUMN language_id INTEGER;
ALTER TABLE project_attachments ADD CONSTRAINT project_attachments_category_id_fkey 
  FOREIGN KEY(category_id) REFERENCES categories (id);
ALTER TABLE project_attachments ADD CONSTRAINT project_attachments_language_id_fkey 
  FOREIGN KEY(language_id) REFERENCES languages (id);
```

**SQL Operations (Downgrade):**
```sql
ALTER TABLE project_attachments DROP CONSTRAINT project_attachments_language_id_fkey;
ALTER TABLE project_attachments DROP CONSTRAINT project_attachments_category_id_fkey;
ALTER TABLE project_attachments DROP COLUMN language_id;
ALTER TABLE project_attachments DROP COLUMN category_id;

ALTER TABLE project_images DROP CONSTRAINT project_images_language_id_fkey;
ALTER TABLE project_images DROP COLUMN language_id;
```

---

## Testing Checklist

- [ ] Backend API accepts language_id parameter for project image upload
- [ ] Backend API accepts language_id and category_id parameters for project attachment upload
- [ ] Project images can be created with language association
- [ ] Project attachments can be created with language and category association
- [ ] Language selector appears in ProjectImageForm UI
- [ ] Language and category selectors appear in ProjectAttachments upload dialog
- [ ] API responses include nested language and category objects
- [ ] Filtering/querying by language works (if implemented)
- [ ] Foreign key constraints prevent invalid language/category IDs

---

## Usage

### Backend

**Upload project image with language:**
```bash
POST /api/projects/{project_id}/images
Content-Type: multipart/form-data

file: (binary)
category: "screenshots"
language_id: 1  # e.g., English
description: "Homepage screenshot in English"
```

**Upload project attachment with language and category:**
```bash
POST /api/projects/{project_id}/attachments
Content-Type: multipart/form-data

file: (binary)
category_id: 5     # e.g., Documentation category
language_id: 2     # e.g., Spanish
```

### Frontend

Users can now:
1. Select a language when uploading project images (optional)
2. Select both category and language when uploading project attachments (optional)
3. Leave these fields empty for default/language-neutral assets

---

## Benefits

1. **Multi-language Support:** Projects can have language-specific images and documents
2. **Better Organization:** Files can be categorized and associated with languages
3. **Consistency:** Aligns project assets with existing portfolio asset structure
4. **Flexibility:** Language and category associations are optional (nullable)
5. **Scalability:** Easy to filter, query, or display assets by language

---

## Notes

- All new fields are **optional** (nullable), ensuring backward compatibility
- No existing data is affected by this change
- The migration can be rolled back if needed using `alembic downgrade`
- Category support for project attachments was added as a bonus enhancement
- The implementation follows the same patterns as portfolio images/attachments

---

## Related Files

### Backend
- `portfolio-backend/alembic/versions/d79f10af21da_*.py`
- `portfolio-backend/app/models/project.py`
- `portfolio-backend/app/schemas/project.py`
- `portfolio-backend/app/api/endpoints/projects.py`
- `portfolio-backend/app/crud/project.py`

### Frontend
- `backend-ui/src/components/projects/ProjectImageForm.js`
- `backend-ui/src/components/projects/ProjectAttachments.js`

---

## Migration Commands

**Apply migration:**
```bash
cd portfolio-backend
source venv/bin/activate
alembic upgrade head
```

**Rollback migration:**
```bash
alembic downgrade -1
```

**Check current version:**
```bash
alembic current
```

**Verify columns were created:**
```bash
python -c "
from sqlalchemy import create_engine, inspect
engine = create_engine('postgresql://postgres:postgres@localhost:5432/portfolioai_dev')
inspector = inspect(engine)
print('project_images columns:', [col['name'] for col in inspector.get_columns('project_images')])
print('project_attachments columns:', [col['name'] for col in inspector.get_columns('project_attachments')])
"
```

## Troubleshooting

### Issue: Migration marked as applied but columns don't exist

**Symptom:** `psycopg2.errors.UndefinedColumn: column project_images.language_id does not exist`

**Cause:** The migration file had empty `upgrade()` and `downgrade()` functions when initially created.

**Solution:**
1. Verify migration file has actual SQL operations (not just `pass`)
2. Stamp database to previous revision: `alembic stamp 1656f139efd4`
3. Re-run upgrade: `alembic upgrade head`
4. Verify columns exist (see command above)

### Issue: 422 error when loading Projects page

**Symptom:** `Request failed with status code 422` in browser console

**Cause:** Categories endpoint returns paginated response but code tried to use data directly as array

**Solution:** Extract items from paginated response: `categoriesResponse.data.items || []`

