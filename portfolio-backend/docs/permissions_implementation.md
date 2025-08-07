# Permissions Implementation Guide

## Overview
This document outlines the required backend implementation for handling permissions in the role management system. The frontend Role management system requires specific API endpoints and data structures to function correctly.

## Required Endpoints

### 1. Permissions Listing Endpoint
```http
GET /api/permissions/
```

**Response Format:**
```json
[
  "CREATE_USER",
  "EDIT_USER",
  "DELETE_USER",
  "VIEW_USER",
  "CREATE_ROLE",
  "EDIT_ROLE",
  "DELETE_ROLE",
  "VIEW_ROLE"
]
```

This endpoint should return an array of all available permission strings in the system. These permissions will be used in the role creation/editing forms.

### 2. Role Management Endpoints with Permissions

#### Create Role
```http
POST /api/roles/
```

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "permissions": ["PERMISSION_1", "PERMISSION_2", ...]
}
```

**Response Format:**
```json
{
  "id": "number",
  "name": "string",
  "description": "string",
  "permissions": ["PERMISSION_1", "PERMISSION_2", ...],
  "users": 0
}
```

#### Update Role
```http
PUT /api/roles/{id}
```

**Request Body:**
```json
{
  "name": "string",
  "description": "string",
  "permissions": ["PERMISSION_1", "PERMISSION_2", ...]
}
```

**Response Format:**
```json
{
  "id": "number",
  "name": "string",
  "description": "string",
  "permissions": ["PERMISSION_1", "PERMISSION_2", ...],
  "users": "number"
}
```

#### Get Roles (with pagination and filtering)
```http
GET /api/roles/?page={page}&pageSize={pageSize}&sortField={field}&sortOrder={order}&filterField={field}&filterValue={value}&filterOperator={operator}
```

**Response Format:**
```json
{
  "items": [
    {
      "id": "number",
      "name": "string",
      "description": "string",
      "permissions": ["PERMISSION_1", "PERMISSION_2", ...],
      "users": "number"
    }
  ],
  "total": "number"
}
```

#### Delete Role
```http
DELETE /api/roles/{id}
```

**Response:** HTTP 204 No Content

## Implementation Details

### 1. Permission Management
- Implement a system to store and manage available permissions
- Each permission should be a unique string identifier
- Common format: `ACTION_RESOURCE` (e.g., "CREATE_USER", "EDIT_ROLE")
- Consider grouping permissions by resource for easier management

### 2. Role-Permission Relationship
- Store role-permission relationships in the database
- Allow many-to-many relationship between roles and permissions
- Ensure proper cascading on role deletion

### 3. Permission Validation
- Validate requested permissions against available permissions
- Ensure users can't assign non-existent permissions
- Consider implementing permission hierarchy or dependencies

### 4. Error Handling
Return appropriate HTTP status codes and error messages:
- 400 Bad Request: Invalid input data
- 403 Forbidden: Insufficient permissions
- 404 Not Found: Role not found
- 409 Conflict: Role name already exists

**Example Error Response:**
```json
{
  "detail": "Error message here",
  "code": "ERROR_CODE",
  "fields": {
    "fieldName": "Field specific error"
  }
}
```

### 5. Performance Considerations
- Cache permission list if it rarely changes
- Use database indexing for permission lookups
- Consider bulk operations for permission assignments

### 6. Security Considerations
- Implement role-based access control (RBAC) for the endpoints
- Validate user permissions before allowing role modifications
- Log permission changes for audit purposes
- Prevent deletion of system-critical roles

## Core Permission Set
Implement the following core permissions:

### User Management
- CREATE_USER
- EDIT_USER
- DELETE_USER
- VIEW_USER

### Role Management
- CREATE_ROLE
- EDIT_ROLE
- DELETE_ROLE
- VIEW_ROLE

You can extend this set based on your application's needs.

## Testing Recommendations
1. Unit test permission validation
2. Test role CRUD operations with permissions
3. Test edge cases (empty permissions, invalid permissions)
4. Test permission assignment constraints
5. Test role deletion with assigned users