/*
PROJECT OVERVIEW:
We are building a FastAPI backend for a multilingual portfolio app. The requirements, data models, and API endpoints are defined in two documents:
- "backend_prompt.md", which details the data models, endpoints, authentication, file handling, and admin panel integration.
- "frontend_implementation.md" (located in the project folder) which provides additional context and integration details for our frontend.

TASK:
Using the instructions provided in these two files, create a complete FastAPI project that includes:
   - SQLAlchemy models and Pydantic schemas for Projects, Experiences, Skills, Media Files, Users/Admins, and Chat Messages.
   - CRUD endpoints for Projects and Experiences (and similar structure for Skills, Media Files).
   - Authentication endpoints (login, refresh, logout) using JWT tokens with refresh support.
   - File upload, media retrieval, and deletion endpoints.
   - Resume endpoint to serve multilingual resumes.
   - WebSocket endpoint for real-time chat communication, with a fallback POST endpoint.
   - CORS configured for http://localhost:5173.
   - Integration with FastAPI Admin for an admin interface (to handle CRUD operations, file management, user management, and translations).
   - Security features such as JWT-based role-based access control, input validation, file size and format checks, and rate limiting.
   - Performance optimizations like caching, eager loading, and pagination support.
   - Complete API documentation provided by Swagger UI and ReDoc.

OUTPUT:
Generate a fully-structured FastAPI backend project with the model definitions, routes, authentication, admin panel integration, and documentation as per the provided requirements.

Proceed to construct the project based on these inputs.
*/