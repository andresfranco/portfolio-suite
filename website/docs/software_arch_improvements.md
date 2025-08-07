# Local Development Architecture Improvements

This document outlines recommended software architecture improvements for the Portfolio AI project during local development, focusing on FastAPI and React best practices.

## 1. FastAPI Backend Improvements

### 1.1 API Endpoint Standardization

**Issue:** Looking at your `skills.py` file, there are overlapping endpoints with similar functionality (`/` and `/full`).

**Recommendation:**
- Consolidate the duplicate endpoints (`read_skills` and `read_skills_full`)
- Use query parameters to control the level of detail returned

```python
# filepath: /home/andres/projects/portfolio-ai/portfolio-backend/app/api/endpoints/skills.py
@router.get("/", response_model=schemas.PaginatedResponse[schemas.Skill])
def read_skills(
    db: Session = Depends(deps.get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = "asc",
    type_filter: Optional[str] = None,
    name_filter: Optional[str] = None,
    include_full_details: bool = Query(False),
    filter_field: Optional[List[str]] = Query(None),
    filter_value: Optional[List[str]] = Query(None),
    filter_operator: Optional[List[str]] = Query(None),
) -> Any:
    """
    Retrieve skills with pagination and optional filtering.
    Set include_full_details=True to get the same behavior as the /full endpoint.
    """
    logger.debug(f"Getting skills with page={page}, page_size={page_size}")
    
    # Process filter parameters if they exist
    parsed_filters = []
    if filter_field and filter_value:
        operators = filter_operator if filter_operator else ['contains'] * len(filter_field)
        for i, field in enumerate(filter_field):
            if i < len(filter_value):
                try:
                    op = operators[i] if i < len(operators) else "contains"
                    parsed_filters.append(schemas.skill.Filter.from_params(
                        field=field, 
                        value=filter_value[i],
                        operator=op
                    ))
                except ValueError as e:
                    raise HTTPException(status_code=400, detail=str(e))
    
    # Get skills with all parameters
    skills, total = skill_crud.get_skills_paginated(
        db=db,
        page=page,
        page_size=page_size,
        filters=parsed_filters,
        type_filter=type_filter,
        name_filter=name_filter,
        sort_field=sort_field,
        sort_order=sort_order
    )
    
    processed_skills = process_skills_for_response(skills)
    
    return {
        "items": processed_skills,
        "total": total,
        "page": page,
        "page_size": page_size
    }
```

### 1.2 Replace Manual Serialization with Pydantic Models

**Issue:** The `process_skills_for_response` function performs manual serialization.

**Recommendation:**
- Use Pydantic models with ORM mode to handle serialization

```python
# filepath: /home/andres/projects/portfolio-ai/portfolio-backend/app/schemas/skill.py
from typing import List, Optional
from pydantic import BaseModel
from datetime import datetime

class SkillTextBase(BaseModel):
    language_id: int
    name: str
    description: Optional[str] = None

class SkillText(SkillTextBase):
    id: int
    
    class Config:
        orm_mode = True

class CategoryBase(BaseModel):
    code: str
    type_code: Optional[str] = None

class Category(CategoryBase):
    id: int
    
    class Config:
        orm_mode = True

class SkillTypeBase(BaseModel):
    code: str
    name: str

class SkillType(SkillTypeBase):
    id: int
    
    class Config:
        orm_mode = True

class SkillBase(BaseModel):
    type: Optional[str] = ""
    type_code: Optional[str] = None

class SkillCreate(SkillBase):
    skill_texts: List[SkillTextBase]
    category_ids: Optional[List[int]] = []

class SkillUpdate(SkillBase):
    skill_texts: Optional[List[SkillTextBase]] = None
    category_ids: Optional[List[int]] = None

class Skill(SkillBase):
    id: int
    skill_texts: List[SkillText]
    categories: List[Category]
    skill_type: Optional[SkillType] = None
    
    class Config:
        orm_mode = True
```

With these Pydantic models, you can simplify your endpoint:

```python
# filepath: /home/andres/projects/portfolio-ai/portfolio-backend/app/api/endpoints/skills.py
@router.get("/{skill_id}", response_model=schemas.Skill)
def read_skill(
    *,
    db: Session = Depends(deps.get_db),
    skill_id: int,
) -> Any:
    """
    Get skill by ID.
    """
    skill = skill_crud.get_skill(db, skill_id=skill_id)
    if not skill:
        raise HTTPException(status_code=404, detail="Skill not found")
    
    # No need for manual processing - Pydantic handles it
    return skill
```

### 1.3 Advanced Query Framework

**Issue:** Complex filtering logic is duplicated in several places.

**Recommendation:**
- Create a reusable query builder to standardize filtering and pagination

```python
# filepath: /home/andres/projects/portfolio-ai/portfolio-backend/app/api/utils/query_builder.py
from sqlalchemy.orm import Session, Query
from typing import Type, List, Optional, Any, Tuple
from sqlalchemy import asc, desc
from app.schemas.skill import Filter

class QueryBuilder:
    def __init__(self, model: Type, db: Session):
        self.model = model
        self.db = db
        self.query = db.query(model)
    
    def apply_filters(self, filters: Optional[List[Filter]] = None):
        """Apply filters to the query"""
        if not filters:
            return self
            
        for filter_item in filters:
            field_parts = filter_item.field.split('.')
            if len(field_parts) == 1:
                # Direct model attribute
                field = getattr(self.model, field_parts[0], None)
                if field is None:
                    continue
                    
                # Apply operator
                if filter_item.operator == 'eq':
                    self.query = self.query.filter(field == filter_item.value)
                elif filter_item.operator == 'contains':
                    self.query = self.query.filter(field.ilike(f"%{filter_item.value}%"))
                # Add more operators as needed
        
        return self
    
    def apply_sort(self, sort_field: Optional[str] = None, sort_order: Optional[str] = 'asc'):
        """Apply sorting to the query"""
        if not sort_field:
            return self
            
        field = getattr(self.model, sort_field, None)
        if field is None:
            return self
            
        if sort_order.lower() == 'desc':
            self.query = self.query.order_by(desc(field))
        else:
            self.query = self.query.order_by(asc(field))
            
        return self
    
    def paginate(self, page: int = 1, page_size: int = 10) -> Tuple[List[Any], int]:
        """Paginate results and return items with total count"""
        total = self.query.count()
        items = self.query.offset((page - 1) * page_size).limit(page_size).all()
        return items, total
```

Use the query builder in your CRUD operations:

```python
# filepath: /home/andres/projects/portfolio-ai/portfolio-backend/app/crud/skill.py
from app.api.utils.query_builder import QueryBuilder

def get_skills_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: Optional[List[schemas.skill.Filter]] = None,
    type_filter: Optional[str] = None,
    name_filter: Optional[str] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = "asc"
) -> Tuple[List[models.Skill], int]:
    """
    Get paginated skills with filters and sorting
    """
    # Create query builder
    query_builder = QueryBuilder(models.Skill, db)
    
    # Apply custom filters (type and name)
    if type_filter:
        query_builder.query = query_builder.query.filter(
            models.Skill.type.ilike(f"%{type_filter}%")
        )
        
    if name_filter:
        query_builder.query = query_builder.query.join(
            models.SkillText
        ).filter(
            models.SkillText.name.ilike(f"%{name_filter}%")
        )
    
    # Apply generic filters
    query_builder.apply_filters(filters)
    
    # Apply sorting
    query_builder.apply_sort(sort_field, sort_order)
    
    # Get paginated results
    return query_builder.paginate(page, page_size)
```

### 1.4 Centralized Logging

**Issue:** Logging configuration is duplicated across files (seen in your skills.py).

**Recommendation:**
- Centralize logging configuration in a dedicated module

```python
# filepath: /home/andres/projects/portfolio-ai/portfolio-backend/app/core/logging.py
import logging
import sys
from app.core.config import settings

def setup_logger(name: str) -> logging.Logger:
    """Set up and return a logger with consistent configuration"""
    logger = logging.getLogger(name)
    
    # Only add handlers if they don't exist
    if not logger.handlers:
        console_handler = logging.StreamHandler(sys.stderr)
        formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
        console_handler.setFormatter(formatter)
        logger.addHandler(console_handler)
        
        # Set level based on environment
        if settings.ENVIRONMENT == "development":
            logger.setLevel(logging.DEBUG)
        else:
            logger.setLevel(logging.INFO)
    
    return logger
```

Then in your endpoints file:

```python
# filepath: /home/andres/projects/portfolio-ai/portfolio-backend/app/api/endpoints/skills.py
from app.core.logging import setup_logger

# Replace your current logging setup with this
logger = setup_logger("app.api.endpoints.skills")
```

## 2. React Frontend Improvements

### 2.1 State Management

**Recommendation:**
- Implement React Context API or Redux for global state management

```javascript
// filepath: /home/andres/projects/portfolio-ai/backend-ui/src/contexts/SkillsContext.js
import React, { createContext, useContext, useState, useCallback } from 'react';
import { api } from '../services/api';

// Create context
const SkillsContext = createContext();

export function SkillsProvider({ children }) {
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0
  });

  const fetchSkills = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get('/skills', { params });
      
      setSkills(response.data.items);
      setPagination({
        page: response.data.page,
        pageSize: response.data.page_size,
        total: response.data.total
      });
      
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to fetch skills');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createSkill = useCallback(async (skillData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.post('/skills', skillData);
      
      // Refresh the skills list
      await fetchSkills({ page: pagination.page, pageSize: pagination.pageSize });
      
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to create skill');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchSkills, pagination]);

  const updateSkill = useCallback(async (id, skillData) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.put(`/skills/${id}`, skillData);
      
      // Refresh the skills list
      await fetchSkills({ page: pagination.page, pageSize: pagination.pageSize });
      
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to update skill');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchSkills, pagination]);

  const deleteSkill = useCallback(async (id) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.delete(`/skills/${id}`);
      
      // Refresh the skills list
      await fetchSkills({ page: pagination.page, pageSize: pagination.pageSize });
      
      return response.data;
    } catch (err) {
      setError(err.message || 'Failed to delete skill');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchSkills, pagination]);

  return (
    <SkillsContext.Provider 
      value={{ 
        skills, 
        loading, 
        error, 
        pagination, 
        fetchSkills, 
        createSkill, 
        updateSkill, 
        deleteSkill 
      }}
    >
      {children}
    </SkillsContext.Provider>
  );
}

// Custom hook to use the skills context
export function useSkills() {
  const context = useContext(SkillsContext);
  if (!context) {
    throw new Error('useSkills must be used within a SkillsProvider');
  }
  return context;
}
```

### 2.2 API Client Abstraction

**Recommendation:**
- Create a dedicated API client layer

```javascript
// filepath: /home/andres/projects/portfolio-ai/backend-ui/src/services/api.js
import axios from 'axios';

// Create axios instance with base configuration
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:8000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor for authentication
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle authentication errors
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Skills API
const skillsApi = {
  getSkills: (params) => api.get('/skills', { params }),
  getSkillById: (id) => api.get(`/skills/${id}`),
  createSkill: (data) => api.post('/skills', data),
  updateSkill: (id, data) => api.put(`/skills/${id}`, data),
  deleteSkill: (id) => api.delete(`/skills/${id}`),
  checkUnique: (params) => api.get('/skills/check-unique', { params })
};

export { api, skillsApi };
```

### 2.3 Code Splitting and Lazy Loading

**Recommendation:**
- Implement React.lazy() for code splitting

```javascript
// filepath: /home/andres/projects/portfolio-ai/portfolioai/src/App.js
import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LoadingSpinner from './components/common/LoadingSpinner';

// Lazy load page components
const Home = React.lazy(() => import('./pages/Home'));
const About = React.lazy(() => import('./pages/About'));
const Projects = React.lazy(() => import('./pages/Projects'));
const ProjectDetails = React.lazy(() => import('./pages/ProjectDetails'));
const Skills = React.lazy(() => import('./pages/Skills'));
const Contact = React.lazy(() => import('./pages/Contact'));
const NotFound = React.lazy(() => import('./pages/NotFound'));

function App() {
  return (
    <Router>
      <Suspense fallback={<LoadingSpinner />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:id" element={<ProjectDetails />} />
          <Route path="/skills" element={<Skills />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Router>
  );
}

export default App;
```

## 3. Error Handling Improvements

**Recommendation:**
- Implement consistent error handling across the application

```python
# filepath: /home/andres/projects/portfolio-ai/portfolio-backend/app/main.py
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.exc import SQLAlchemyError
from app.core.logging import setup_logger

# Set up application logger
logger = setup_logger("app.main")

app = FastAPI(title="Portfolio CMS API")

# Exception handlers
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(f"Validation error: {exc.errors()}")
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": exc.errors()},
    )

@app.exception_handler(SQLAlchemyError)
async def sqlalchemy_exception_handler(request: Request, exc: SQLAlchemyError):
    logger.error(f"Database error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Database error occurred"},
    )

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unexpected error: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred"},
    )
```

And in React:

```javascript
// filepath: /home/andres/projects/portfolio-ai/backend-ui/src/components/common/ErrorBoundary.js
import React, { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    // You can log the error to a service here
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h2>Something went wrong</h2>
          <p>Please try again later or contact support if the problem persists.</p>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
```

## 4. Testing Strategy

**Recommendation:**
- Implement comprehensive testing for backend and frontend

```python
# filepath: /home/andres/projects/portfolio-ai/portfolio-backend/tests/api/test_skills.py
from fastapi.testclient import TestClient
import pytest
from app.main import app
from app.db.session import SessionLocal
from app.models.skill import Skill

client = TestClient(app)

@pytest.fixture
def db_session():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def test_read_skills():
    response = client.get("/skills/")
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert "page" in data
    assert "page_size" in data

def test_read_skill_not_found():
    response = client.get("/skills/999999")
    assert response.status_code == 404
    assert response.json()["detail"] == "Skill not found"

def test_create_skill():
    skill_data = {
        "type": "programming",
        "type_code": "prog",
        "skill_texts": [
            {
                "language_id": 1,
                "name": "Test Skill",
                "description": "This is a test skill"
            }
        ],
        "category_ids": []
    }
    
    response = client.post("/skills/", json=skill_data)
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "programming"
    assert data["type_code"] == "prog"
    assert len(data["skill_texts"]) == 1
    assert data["skill_texts"][0]["name"] == "Test Skill"
    
    # Clean up - delete the created skill
    skill_id = data["id"]
    client.delete(f"/skills/{skill_id}")
```

And for React:

```javascript
// filepath: /home/andres/projects/portfolio-ai/backend-ui/src/components/skills/SkillsList.test.js
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SkillsProvider } from '../../contexts/SkillsContext';
import SkillsList from './SkillsList';
import { skillsApi } from '../../services/api';

// Mock the API
jest.mock('../../services/api');

describe('SkillsList', () => {
  const mockSkills = [
    {
      id: 1,
      type: 'programming',
      type_code: 'prog',
      skill_texts: [
        {
          id: 1,
          language_id: 1,
          name: 'JavaScript',
          description: 'A programming language'
        }
      ],
      categories: [],
      skill_type: {
        code: 'prog',
        name: 'Programming'
      }
    },
    {
      id: 2,
      type: 'soft',
      type_code: 'soft',
      skill_texts: [
        {
          id: 2,
          language_id: 1,
          name: 'Communication',
          description: 'Effective communication skills'
        }
      ],
      categories: [],
      skill_type: {
        code: 'soft',
        name: 'Soft Skills'
      }
    }
  ];

  beforeEach(() => {
    skillsApi.getSkills.mockResolvedValue({
      data: {
        items: mockSkills,
        total: 2,
        page: 1,
        page_size: 10
      }
    });
  });

  test('renders skills list and displays skills', async () => {
    render(
      <SkillsProvider>
        <SkillsList />
      </SkillsProvider>
    );

    // Should show loading initially
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for skills to load
    await waitFor(() => {
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
      expect(screen.getByText('Communication')).toBeInTheDocument();
    });
  });

  test('handles pagination correctly', async () => {
    render(
      <SkillsProvider>
        <SkillsList />
      </SkillsProvider>
    );

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByText('JavaScript')).toBeInTheDocument();
    });

    // Mock the next page response
    skillsApi.getSkills.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 3,
            type: 'language',
            type_code: 'lang',
            skill_texts: [
              {
                id: 3,
                language_id: 1,
                name: 'English',
                description: 'English language skills'
              }
            ],
            categories: [],
            skill_type: {
              code: 'lang',
              name: 'Languages'
            }
          }
        ],
        total: 3,
        page: 2,
        page_size: 10
      }
    });

    // Click next page button
    userEvent.click(screen.getByLabelText(/next page/i));

    // Should show the skill on the next page
    await waitFor(() => {
      expect(screen.getByText('English')).toBeInTheDocument();
    });
  });
});
```

## Conclusion

These architectural improvements will enhance your local development workflow by:

1. Standardizing API endpoints and reducing duplication
2. Leveraging Pydantic for data validation and serialization
3. Centralizing and reusing common functionality
4. Implementing proper error handling
5. Setting up a comprehensive testing strategy

Implementing these changes will lead to a more maintainable codebase and a more efficient development process.