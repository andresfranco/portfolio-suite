# Frontend Implementation Documentation
This document aims to provide detailed information about the React front end of the application, along with the requirements needed in the backend to be implemented.
## Project Overview
This is a multilingual portfolio application built with React that showcases projects and professional experience. The application supports dynamic language switching (currently English and Spanish) and includes an AI chat assistant integration.

## Core Features

### Multilingual Support
- Implemented using React Context
- Supports English (en) and Spanish (es)
- All content is structured with language-specific objects:

## Data Structure

```typescript
interface Project {
  id: number;
  title: {
    en: string;
    es: string;
  };
  description: {
    en: string;
    es: string;
  };
  brief: {
    en: string;
    es: string;
  };
  date: {
    en: string;
    es: string;
  };
  category: {
    en: string;
    es: string;
  };
  image: string;
  skills: Array<{
    name: {
      en: string;
      es: string;
    };
  }>;
  liveUrl?: string;
  repoUrl?: string;
}

```

## Required Endpoints

GET /api/projects - List all projects
GET /api/projects/{id} - Get project details
POST /api/projects - Create new project
PUT /api/projects/{id} - Update project
DELETE /api/projects/{id} - Delete project

## Resume Download
Language-specific PDF files
Naming convention: {language_code}_resume.pdf
Required endpoint: GET /api/resume/{language}

## AI Chat Assistant
Real-time chat interface
Requires WebSocket connection
Should understand context about projects and experience
Required endpoints:
WS /ws/chat - WebSocket connection for chat
POST /api/chat/message - Alternative REST endpoint

## File Management
Requirements: 
Image upload for projects
Resume PDF management
Supported formats: jpg, png, pdf
Max file size: 5MB
Required endpoints:
POST /api/upload - File upload
DELETE /api/files/{id} - Delete file

## Authentication & Authorization
dmin panel access
JWT-based authentication
Required endpoints:
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout

## Data Relationships

graph TD
    Project -->|has many| Skills
    Experience -->|has many| Skills
    Project -->|has one| Category
    Project -->|has one| Image


## Required Backend Features

## 1.Multilingual Content Management

Store and serve content in multiple languages
Language fallback system
Translation management

## 2.File Handling

Secure file uploads
Image processing and optimization
File type validation
Storage management

## 3.Performance Optimization

Response caching
Image optimization
Pagination for lists
Eager loading of relationships

## 4.Security Features

JWT authentication
Role-based access control
Input validation
File upload security
CORS configuration

## 5.AI Integration

Chat history management
Context awareness
Rate limiting
Response caching

## Expected Response Formats

{
  "success": {
    "data": {},
    "message": "Operation successful",
    "meta": {
      "pagination": {
        "page": 1,
        "perPage": 10,
        "total": 100
      }
    }
  },
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "details": {}
  }
}

## Required Environment Variables
DATABASE_URL=postgresql://user:pass@localhost:5432/db
JWT_SECRET=your-secret-key
ALLOWED_ORIGINS=http://localhost:5173
MEDIA_STORAGE_PATH=/path/to/media
AI_API_KEY=your-ai-service-key




