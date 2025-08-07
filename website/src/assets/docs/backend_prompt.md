# Backend Development Prompt

Please create a FastAPI Admin backend project for a multilingual portfolio application with the following specifications:

## Project Structure
Create a complete FastAPI project structure with:
1. SQLAlchemy models
2. Pydantic schemas
3. CRUD operations
4. JWT authentication
5. File handling
6. WebSocket support for chat
7. Admin panel integration
8. Multilingual content management

## Core Requirements
1. Database: PostgreSQL
2. Authentication: JWT with refresh tokens
3. File Storage: Support for images and PDFs
4. WebSocket: For real-time chat
5. CORS: Configuration for frontend at http://localhost:5173
6. Admin Interface: FastAPI Admin integration
7. API Documentation: Swagger UI and ReDoc

## Data Models Needed
1. Projects (with multilingual fields)
2. Experiences (with multilingual fields)
3. Skills (with multilingual fields)
4. Media Files
5. Users/Admins
6. Chat Messages

## API Endpoints Required
1. Authentication endpoints:
   - POST /api/auth/login
   - POST /api/auth/refresh
   - POST /api/auth/logout

2. Projects endpoints:
   - GET /api/projects
   - GET /api/projects/{id}
   - POST /api/admin/projects
   - PUT /api/admin/projects/{id}
   - DELETE /api/admin/projects/{id}

3. Experiences endpoints:
   - Similar CRUD structure as projects

4. File management:
   - POST /api/upload
   - GET /api/media/{filename}
   - DELETE /api/admin/media/{id}

5. Resume endpoints:
   - GET /api/resume/{language}

6. Chat endpoints:
   - WebSocket /ws/chat
   - POST /api/chat/message (fallback)

## Technical Requirements
1. Multilingual support:
   - Store content in multiple languages (en, es)
   - Language-specific response handling
   - Translation management system

2. File handling:
   - Max file size: 5MB
   - Supported formats: jpg, png, pdf
   - Image optimization
   - Secure file validation

3. Security:
   - JWT authentication
   - Role-based access control
   - Input validation
   - CORS configuration
   - Rate limiting

4. Performance:
   - Response caching
   - Database query optimization
   - Eager loading relationships
   - Pagination support

5. Admin Panel:
   - CRUD operations for all models
   - File management interface
   - User management
   - Translation management
