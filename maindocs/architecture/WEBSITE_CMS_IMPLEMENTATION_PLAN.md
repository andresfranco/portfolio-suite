# Website CMS Implementation Plan
## WordPress-like Content Management for Portfolio Website

**Created**: October 25, 2025  
**Status**: Planning Phase  
**Complexity**: High (Multi-phase implementation)

---

## 🎯 Project Goals

Build a WordPress-like visual CMS that allows authenticated users with editor permissions to modify website content directly through a graphical interface, with the following key features:

1. **Multi-Portfolio Support**: Each portfolio has its own associated website; the default portfolio is displayed at `/website`
2. **Multilingual Content**: Display content based on selected language (existing LanguageContext)
3. **Visual Editing**: In-place content editing similar to WordPress with visual indicators
4. **Permission-Based Access**: Only users with editor permissions can enter edit mode

---

## 📋 Current State Analysis

### ✅ Existing Infrastructure

**Backend (`portfolio-backend/`):**
- ✅ FastAPI with PostgreSQL
- ✅ Portfolio model with categories, experiences, projects, sections
- ✅ Multilingual support (languages, translations)
- ✅ Authentication & RBAC (roles, permissions)
- ✅ File upload (images, attachments)
- ✅ API endpoints: `/api/portfolios/`, `/api/projects/`, `/api/experiences/`

**Website (`website/`):**
- ✅ React 19 with React Router
- ✅ LanguageContext for i18n
- ✅ Tailwind CSS for styling
- ✅ Static data in `/src/data/portfolio.js`
- ✅ Pages: HomePage, Projects, ProjectDetails, ExperienceDetails, Contact

### ❌ Missing Components

1. **Backend:**
   - ❌ `is_default` flag on Portfolio model
   - ❌ Public API endpoints for website consumption (no auth required)
   - ❌ CMS-specific endpoints for content updates
   - ❌ Draft/publish workflow

2. **Website:**
   - ❌ API integration (currently using static data)
   - ❌ Edit mode toggle and context
   - ❌ Inline content editors
   - ❌ Authentication integration for editors
   - ❌ Auto-save and preview functionality

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     WEBSITE FRONTEND                         │
│                                                               │
│  ┌─────────────┐      ┌──────────────┐      ┌────────────┐ │
│  │   View Mode │◄────►│ EditModeCtx  │◄────►│  Edit Mode │ │
│  │  (Default)  │      │  (Provider)  │      │ (Editors)  │ │
│  └─────────────┘      └──────────────┘      └────────────┘ │
│         │                     │                     │        │
│         │              ┌──────▼──────┐              │        │
│         └─────────────►│  API Layer  │◄─────────────┘        │
│                        └──────┬──────┘                       │
└───────────────────────────────┼──────────────────────────────┘
                                │
                         HTTP/REST API
                                │
┌───────────────────────────────▼──────────────────────────────┐
│                   BACKEND (FastAPI)                           │
│                                                               │
│  ┌──────────────┐     ┌─────────────┐     ┌───────────────┐│
│  │ Public API   │     │ CMS API     │     │ Admin API     ││
│  │ (No Auth)    │     │ (Editors)   │     │ (Full CRUD)   ││
│  └──────┬───────┘     └──────┬──────┘     └───────┬───────┘│
│         │                    │                    │         │
│         └────────────────────┼────────────────────┘         │
│                              │                              │
│                     ┌────────▼────────┐                     │
│                     │  CRUD Layer     │                     │
│                     └────────┬────────┘                     │
│                              │                              │
│                     ┌────────▼────────┐                     │
│                     │   PostgreSQL    │                     │
│                     │   (Portfolio)   │                     │
│                     └─────────────────┘                     │
└───────────────────────────────────────────────────────────────┘
```

---

## 📅 Implementation Phases

### **Phase 1: Backend API Extensions** (2-3 days)

#### 1.1 Database Schema Updates
```sql
-- Add is_default to portfolios table
ALTER TABLE portfolios ADD COLUMN is_default BOOLEAN DEFAULT FALSE;

-- Ensure only one default portfolio
CREATE UNIQUE INDEX idx_single_default_portfolio 
ON portfolios (is_default) 
WHERE is_default = TRUE;
```

#### 1.2 New Backend Endpoints

**Public API (No Authentication Required):**
```python
# portfolio-backend/app/api/endpoints/website.py

@router.get("/default", response_model=PortfolioPublicOut)
def get_default_portfolio(
    language_code: str = Query("en", description="Language code (en, es)"),
    db: Session = Depends(deps.get_db)
) -> Any:
    """Get default portfolio for website display with specified language."""
    pass

@router.get("/portfolios/{portfolio_id}/public", response_model=PortfolioPublicOut)
def get_public_portfolio(
    portfolio_id: int,
    language_code: str = Query("en"),
    db: Session = Depends(deps.get_db)
) -> Any:
    """Get specific portfolio for public website display."""
    pass
```

**CMS API (Editor Permissions Required):**
```python
# portfolio-backend/app/api/endpoints/cms.py

@router.patch("/content/text/{text_id}")
@require_permission("EDIT_CONTENT")
def update_text_content(
    text_id: int,
    content: ContentUpdateRequest,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
) -> Any:
    """Update text content (project/experience descriptions, etc.)"""
    pass

@router.post("/content/images")
@require_permission("EDIT_CONTENT")
def upload_content_image(
    file: UploadFile,
    entity_type: str,  # 'portfolio', 'project', 'experience'
    entity_id: int,
    category: str,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
) -> Any:
    """Upload/replace image for content entity."""
    pass

@router.patch("/content/order")
@require_permission("EDIT_CONTENT")
def reorder_content(
    reorder_request: ReorderRequest,
    current_user: User = Depends(deps.get_current_user),
    db: Session = Depends(deps.get_db)
) -> Any:
    """Reorder projects, experiences, or sections."""
    pass
```

#### 1.3 Permission Setup
```python
# Add to app/crud/permission.py or migration
permissions = [
    {"code": "VIEW_CONTENT", "name": "View Content", "description": "View published content"},
    {"code": "EDIT_CONTENT", "name": "Edit Content", "description": "Edit website content via CMS"},
    {"code": "PUBLISH_CONTENT", "name": "Publish Content", "description": "Publish drafted changes"},
]

# Assign to Editor role
```

---

### **Phase 2: Website Data Integration** (2-3 days)

#### 2.1 API Service Layer
```javascript
// website/src/services/portfolioApi.js

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const portfolioApi = {
  // Fetch default portfolio with language
  getDefaultPortfolio: async (languageCode = 'en') => {
    const response = await fetch(
      `${API_BASE_URL}/api/website/default?language_code=${languageCode}`
    );
    return response.json();
  },
  
  // Fetch specific portfolio
  getPortfolio: async (portfolioId, languageCode = 'en') => {
    const response = await fetch(
      `${API_BASE_URL}/api/website/portfolios/${portfolioId}/public?language_code=${languageCode}`
    );
    return response.json();
  },
  
  // CMS operations (authenticated)
  updateTextContent: async (textId, content, token) => {
    const response = await fetch(
      `${API_BASE_URL}/api/cms/content/text/${textId}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(content)
      }
    );
    return response.json();
  },
  
  uploadImage: async (file, entityType, entityId, category, token) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('entity_type', entityType);
    formData.append('entity_id', entityId);
    formData.append('category', category);
    
    const response = await fetch(
      `${API_BASE_URL}/api/cms/content/images`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      }
    );
    return response.json();
  }
};
```

#### 2.2 Portfolio Context
```javascript
// website/src/context/PortfolioContext.js

export const PortfolioProvider = ({ children }) => {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);
  const { currentLanguage } = useLanguage();
  
  useEffect(() => {
    loadPortfolio();
  }, [currentLanguage]);
  
  const loadPortfolio = async () => {
    setLoading(true);
    try {
      const data = await portfolioApi.getDefaultPortfolio(currentLanguage);
      setPortfolio(data);
    } catch (error) {
      console.error('Failed to load portfolio:', error);
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <PortfolioContext.Provider value={{ portfolio, loading, refreshPortfolio: loadPortfolio }}>
      {children}
    </PortfolioContext.Provider>
  );
};
```

#### 2.3 Replace Static Data
- Update all components to use `usePortfolio()` hook instead of importing `portfolioData`
- Remove `/src/data/portfolio.js` static file
- Update components: Hero.js, Projects.js, ExperienceDetailsPage.js, etc.

---

### **Phase 3: Edit Mode & CMS Foundation** (3-4 days)

#### 3.1 Edit Mode Context
```javascript
// website/src/context/EditModeContext.js

export const EditModeProvider = ({ children }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  
  // Check if user has editor permissions
  const canEdit = user?.permissions?.includes('EDIT_CONTENT');
  
  const login = async (credentials) => {
    // Call backend auth API
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    const data = await response.json();
    
    setUser(data.user);
    setAuthToken(data.access_token);
    localStorage.setItem('cms_token', data.access_token);
  };
  
  const logout = () => {
    setUser(null);
    setAuthToken(null);
    setIsEditMode(false);
    localStorage.removeItem('cms_token');
  };
  
  const toggleEditMode = () => {
    if (canEdit) {
      setIsEditMode(!isEditMode);
    }
  };
  
  return (
    <EditModeContext.Provider 
      value={{ 
        isEditMode, 
        toggleEditMode, 
        canEdit, 
        user, 
        authToken, 
        login, 
        logout 
      }}
    >
      {children}
    </EditModeContext.Provider>
  );
};
```

#### 3.2 Edit Mode UI
```javascript
// website/src/components/cms/EditModeToolbar.js

export const EditModeToolbar = () => {
  const { isEditMode, toggleEditMode, canEdit, user, logout } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  
  if (!user) {
    return <LoginButton />;
  }
  
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-white rounded-lg shadow-lg p-2">
      {canEdit && (
        <button
          onClick={toggleEditMode}
          className={`px-4 py-2 rounded ${
            isEditMode ? 'bg-blue-600 text-white' : 'bg-gray-200'
          }`}
        >
          {isEditMode ? 'Exit Edit Mode' : 'Edit Page'}
        </button>
      )}
      
      {isEditMode && (
        <>
          <button onClick={refreshPortfolio} className="px-4 py-2 bg-green-600 text-white rounded">
            Save Changes
          </button>
          <button onClick={() => window.location.reload()} className="px-4 py-2 bg-gray-400 text-white rounded">
            Cancel
          </button>
        </>
      )}
      
      <button onClick={logout} className="px-4 py-2 bg-red-600 text-white rounded">
        Logout
      </button>
    </div>
  );
};
```

#### 3.3 Visual Editing Indicators
```javascript
// website/src/components/cms/EditableWrapper.js

export const EditableWrapper = ({ children, onEdit, className = '' }) => {
  const { isEditMode } = useEditMode();
  
  if (!isEditMode) {
    return children;
  }
  
  return (
    <div 
      className={`relative group ${className}`}
      onClick={onEdit}
    >
      {children}
      <div className="absolute inset-0 border-2 border-blue-500 border-dashed opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
        <span className="absolute top-0 right-0 bg-blue-500 text-white text-xs px-2 py-1">
          Click to edit
        </span>
      </div>
    </div>
  );
};
```

---

### **Phase 4: Content Editing Components** (4-5 days)

#### 4.1 Inline Text Editor
```javascript
// website/src/components/cms/InlineTextEditor.js

export const InlineTextEditor = ({ 
  value, 
  onChange, 
  textId, 
  fieldName, 
  multiline = false 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const { authToken } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  
  const handleSave = async () => {
    try {
      await portfolioApi.updateTextContent(
        textId,
        { [fieldName]: localValue },
        authToken
      );
      await refreshPortfolio();
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };
  
  if (!isEditing) {
    return (
      <EditableWrapper onEdit={() => setIsEditing(true)}>
        {multiline ? <p>{value}</p> : <span>{value}</span>}
      </EditableWrapper>
    );
  }
  
  return (
    <div className="relative">
      {multiline ? (
        <textarea
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          className="w-full p-2 border-2 border-blue-500 rounded"
          rows={5}
        />
      ) : (
        <input
          type="text"
          value={localValue}
          onChange={(e) => setLocalValue(e.target.value)}
          className="w-full p-2 border-2 border-blue-500 rounded"
        />
      )}
      <div className="flex gap-2 mt-2">
        <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded">
          Save
        </button>
        <button 
          onClick={() => {
            setLocalValue(value);
            setIsEditing(false);
          }} 
          className="px-4 py-2 bg-gray-400 text-white rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};
```

#### 4.2 Image Upload Component
```javascript
// website/src/components/cms/ImageUploader.js

export const ImageUploader = ({ 
  currentImage, 
  entityType, 
  entityId, 
  category,
  onUploadSuccess 
}) => {
  const [uploading, setUploading] = useState(false);
  const { authToken } = useEditMode();
  const fileInputRef = useRef(null);
  
  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setUploading(true);
    try {
      await portfolioApi.uploadImage(
        file,
        entityType,
        entityId,
        category,
        authToken
      );
      onUploadSuccess && onUploadSuccess();
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploading(false);
    }
  };
  
  return (
    <EditableWrapper onEdit={() => fileInputRef.current?.click()}>
      <img src={currentImage} alt="" className="w-full h-auto" />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        className="hidden"
      />
      {uploading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <span className="text-white">Uploading...</span>
        </div>
      )}
    </EditableWrapper>
  );
};
```

#### 4.3 Project/Experience Editor Modal
```javascript
// website/src/components/cms/ContentEditorModal.js

export const ContentEditorModal = ({ 
  type, // 'project' or 'experience'
  item, 
  onClose, 
  onSave 
}) => {
  const [formData, setFormData] = useState(item);
  const { currentLanguage } = useLanguage();
  
  const textData = item[`${type}_texts`]?.find(
    t => t.language.code === currentLanguage
  ) || {};
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
        <h2 className="text-2xl font-bold mb-4">
          Edit {type === 'project' ? 'Project' : 'Experience'}
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block mb-2 font-semibold">Name</label>
            <input
              type="text"
              value={textData.name || ''}
              onChange={(e) => {
                // Update logic
              }}
              className="w-full p-2 border rounded"
            />
          </div>
          
          <div>
            <label className="block mb-2 font-semibold">Description</label>
            <textarea
              value={textData.description || ''}
              onChange={(e) => {
                // Update logic
              }}
              rows={6}
              className="w-full p-2 border rounded"
            />
          </div>
          
          {type === 'project' && (
            <>
              <div>
                <label className="block mb-2 font-semibold">Repository URL</label>
                <input
                  type="url"
                  value={formData.repository_url || ''}
                  onChange={(e) => setFormData({...formData, repository_url: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
              
              <div>
                <label className="block mb-2 font-semibold">Website URL</label>
                <input
                  type="url"
                  value={formData.website_url || ''}
                  onChange={(e) => setFormData({...formData, website_url: e.target.value})}
                  className="w-full p-2 border rounded"
                />
              </div>
            </>
          )}
        </div>
        
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 bg-gray-400 text-white rounded">
            Cancel
          </button>
          <button onClick={() => onSave(formData)} className="px-4 py-2 bg-blue-600 text-white rounded">
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

### **Phase 5: Save & Preview System** (2-3 days)

#### 5.1 Auto-Save Hook
```javascript
// website/src/hooks/useAutoSave.js

export const useAutoSave = (data, saveFunction, delay = 2000) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const timeoutRef = useRef(null);
  
  useEffect(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(async () => {
      setIsSaving(true);
      try {
        await saveFunction(data);
        setLastSaved(new Date());
      } catch (error) {
        console.error('Auto-save failed:', error);
      } finally {
        setIsSaving(false);
      }
    }, delay);
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, delay]);
  
  return { isSaving, lastSaved };
};
```

#### 5.2 Undo/Redo System
```javascript
// website/src/hooks/useUndoRedo.js

export const useUndoRedo = (initialState) => {
  const [history, setHistory] = useState([initialState]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const currentState = history[currentIndex];
  
  const setState = (newState) => {
    const newHistory = history.slice(0, currentIndex + 1);
    newHistory.push(newState);
    setHistory(newHistory);
    setCurrentIndex(newHistory.length - 1);
  };
  
  const undo = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };
  
  const redo = () => {
    if (currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };
  
  const canUndo = currentIndex > 0;
  const canRedo = currentIndex < history.length - 1;
  
  return {
    state: currentState,
    setState,
    undo,
    redo,
    canUndo,
    canRedo
  };
};
```

---

### **Phase 6: Testing & Documentation** (2 days)

#### 6.1 Testing Checklist
- [ ] View mode loads default portfolio correctly
- [ ] Language switching updates all content
- [ ] Editor login and permission check
- [ ] Edit mode toggle works
- [ ] Inline text editing saves correctly
- [ ] Image upload and replacement
- [ ] Project/Experience modal editing
- [ ] Auto-save functionality
- [ ] Undo/redo operations
- [ ] Permissions are enforced on backend

#### 6.2 User Documentation
Create guide: `/maindocs/guides/CMS_USER_GUIDE.md`
- How to login as editor
- How to enter edit mode
- How to edit text content
- How to upload images
- How to reorder content
- How to publish changes

---

## 📦 Dependencies to Install

### Website (`/website`)
```bash
npm install --save axios react-query @dnd-kit/core @dnd-kit/sortable
```

### Backend (`/portfolio-backend`)
```bash
# No new dependencies needed - using existing FastAPI stack
```

---

## 🔒 Security Considerations

1. **Authentication**: Use existing JWT token system
2. **Authorization**: Enforce `EDIT_CONTENT` permission on all CMS endpoints
3. **CSRF Protection**: Already implemented in backend
4. **XSS Prevention**: Sanitize all user inputs
5. **File Upload**: Validate file types and sizes (existing system)
6. **Rate Limiting**: Apply to CMS endpoints to prevent abuse

---

## 🚀 Deployment Strategy

1. **Database Migration**: Add `is_default` column to portfolios
2. **Backend Deployment**: Deploy new API endpoints
3. **Permission Setup**: Create and assign editor permissions
4. **Website Deployment**: Deploy CMS-enabled frontend
5. **Testing**: Test in staging environment first
6. **Training**: Train editors on CMS usage
7. **Production**: Roll out to production with monitoring

---

## 📈 Future Enhancements

**Phase 7 (Optional):**
- Rich text editor (Quill, TipTap, or Draft.js)
- Media library management
- Content versioning and history
- Multi-user collaboration (lock mechanism)
- SEO metadata editing
- Custom CSS/theme editing
- Page builder with drag-and-drop components

---

## 🎯 Success Metrics

- [ ] Editors can log in and enter edit mode
- [ ] Content updates appear immediately
- [ ] Changes persist across sessions
- [ ] No breaking changes to existing admin UI
- [ ] Page load time < 2 seconds
- [ ] Edit operations < 500ms response time
- [ ] Zero unauthorized access to edit endpoints

---

**Next Steps**: Begin Phase 1 implementation (Backend API Extensions)
