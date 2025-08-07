# Portfolio Suite

Monorepo containing backend admin panel (React), portfolio backend (FastAPI), and personal portfolio with AI assistant.

## Overview

Portfolio Suite is an integrated monorepo designed for managing and showcasing a personal portfolio, featuring a modern admin panel, a robust backend API, and an intelligent AI assistant. The suite supports multilingual content, secure role-based access, file/document management, and interactive AI features.

## Main Components

### 1. Backend Admin Panel (React)
- Implements a multilingual portfolio application (English & Spanish) using React Context.
- Features include dynamic language switching, project management, category and skill management, resume download, file uploads, and an AI chat assistant.
- Admin panel access is protected using JWT-based authentication.
- Organized with modular components (e.g., Role management, Content Management, Skills, Projects, Experiences) using Material-UI.
- Core endpoints for managing projects, files, authentication, and AI chat are documented.

### 2. Portfolio Backend (FastAPI)
- FastAPI-based REST API with PostgreSQL integration.
- Features include user authentication/authorization, project/category/skill management, multilingual support, file upload, and management.
- External document preview system for PDF, DOCX, XLSX, and TXT files, integrating Google Docs and Microsoft Office viewers for secure, temporary access.
- Role-based access control with granular permissions for users and administrators.
- Organized code structure: `app/` (main API & business logic), `scripts/` (database setup), `static/` (served files), `tests/` (unit/integration tests), `alembic/` (migrations), and `docs/` (comprehensive documentation).
- API documentation available via Swagger UI and ReDoc.

### 3. Personal Portfolio & AI Assistant
- Real-time chat assistant via WebSocket for context-aware responses about projects and experience.
- AI assistant features are integrated with the React front end and connect to backend endpoints for chat and file management.

## Technologies Used

- **Frontend:** React, Material-UI, Context API, WebSockets.
- **Backend:** FastAPI, PostgreSQL, Alembic, Pydantic, SQLAlchemy.
- **Authentication:** JWT tokens, role-based access control.
- **AI Integration:** Custom endpoints for chat and resume download.
- **File Management:** Image and PDF uploads, external document viewers.

## Getting Started

### Backend Setup
1. Create and activate a Python virtual environment.
2. Install dependencies with `pip install -r requirements.txt`.
3. Set up environment variables from `.env.example`.
4. Install PostgreSQL and initialize databases using provided scripts.
5. Start the FastAPI server and access API docs at `/docs` or `/redoc`.

### Frontend Setup
- Refer to `website/src/assets/docs/frontend_implementation.md` for implementation details and environment configuration.

## Security & Permissions

- Detailed security plans for both frontend and backend.
- Role-based access for all resources.
- Production requirements include HTTPS, CORS headers, and publicly accessible servers.

## Documentation

- Comprehensive docs in each module (`docs/`, `README.md`) covering architecture, setup, features, and security.

---

For detailed instructions and usage, see the respective `README.md` files and documentation folders in each module.