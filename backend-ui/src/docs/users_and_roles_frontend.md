# Users and Roles API Specification

This document outlines the available API endpoints for managing users and roles in the system. All user endpoints are prefixed with `/api/users` and role endpoints with `/api/roles`.

## 1. User Endpoints

### 1.1. Create User

- **Method**: POST
- **Endpoint**: `/api/users/`
- **Description**: Creates a new user in the system
- **Request Body**:
  ```json
  {
    "username": "john_doe",
    "email": "john@example.com",
    "password": "securepassword",
    "roles": [1, 2]  // Optional list of role IDs
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "roles": [
      {
        "id": 1,
        "name": "user"
      },
      {
        "id": 2,
        "name": "admin"
      }
    ]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Username already registered
  - `400 Bad Request`: Invalid role IDs

### 1.2. Get User Details

- **Method**: GET
- **Endpoint**: `/api/users/{user_id}`
- **Description**: Retrieves details of a specific user
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "roles": [
      {
        "id": 1,
        "name": "user"
      }
    ]
  }
  ```
- **Error Responses**:
  - `404 Not Found`: User not found

### 1.3. List Users (with Pagination, Sorting, and Filtering)

- **Method**: GET
- **Endpoint**: `/api/users/`
- **Description**: Returns paginated list of users with optional filtering and sorting
- **Query Parameters**:
  - `page` (required, default: 1): Current page number
  - `pageSize` (required, default: 10, max: 100): Items per page
  - `sortField` (optional): Field to sort by ('id', 'username', 'email')
  - `sortOrder` (optional): Sort direction ('asc' or 'desc')
  - `filterField[]` (optional): Fields to filter on (can be specified multiple times)
  - `filterValue[]` (optional): Values to filter with (corresponds to filterField)
  - `filterOperator[]` (optional): Operators to use for filtering (corresponds to filterField)
- **Filter Operators**:
  - `eq`: Equal to
  - `neq`: Not equal to
  - `gt`: Greater than
  - `gte`: Greater than or equal to
  - `lt`: Less than
  - `lte`: Less than or equal to
  - `contains`: Contains substring (default if not specified)
  - `startswith`: Starts with
  - `endswith`: Ends with
- **Example Query**: `/api/users/?page=1&pageSize=10&filterField=username&filterValue=john&filterOperator=contains&sortField=id&sortOrder=desc`
- **Response**: `200 OK`
  ```json
  {
    "items": [
      {
        "id": 2,
        "username": "john_smith",
        "email": "john.smith@example.com",
        "roles": [
          {
            "id": 1,
            "name": "user"
          }
        ]
      },
      {
        "id": 1,
        "username": "john_doe",
        "email": "john@example.com",
        "roles": [
          {
            "id": 1,
            "name": "user"
          }
        ]
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 10
  }
  ```

### 1.4. Update User

- **Method**: PUT
- **Endpoint**: `/api/users/{user_id}`
- **Description**: Updates an existing user
- **Request Body**:
  ```json
  {
    "username": "john_doe_updated",  // Optional
    "email": "john.updated@example.com",  // Optional
    "roles": [1, 3]  // Optional, will replace existing roles
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "username": "john_doe_updated",
    "email": "john.updated@example.com",
    "roles": [
      {
        "id": 1,
        "name": "user"
      },
      {
        "id": 3,
        "name": "editor"
      }
    ]
  }
  ```
- **Error Responses**:
  - `404 Not Found`: User not found
  - `400 Bad Request`: Invalid role IDs

### 1.5. Change Password

- **Method**: POST
- **Endpoint**: `/api/users/change-password`
- **Description**: Changes a user's password
- **Request Body**:
  ```json
  {
    "username": "john_doe",
    "password": "newSecurePassword"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "roles": [
      {
        "id": 1,
        "name": "user"
      }
    ]
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Username not found

### 1.6. Delete User

- **Method**: DELETE
- **Endpoint**: `/api/users/{user_id}`
- **Description**: Removes a user from the system
- **Response**: `200 OK`
  ```json
  {
    "detail": "User deleted"
  }
  ```
- **Error Responses**:
  - `404 Not Found`: User not found

### 1.7. Forgot Password

- **Method**: POST
- **Endpoint**: `/api/users/forgot-password`
- **Description**: Validates if an email address exists in the system
- **Request Body**:
  ```json
  {
    "email": "john@example.com"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "detail": "Email is valid"
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Email is invalid

## 2. Role Endpoints

### 2.1. Create Role

- **Method**: POST
- **Endpoint**: `/api/roles/`
- **Description**: Creates a new role in the system
- **Request Body**:
  ```json
  {
    "name": "administrator",
    "description": "System administrator with full access",
    "permissions": ["VIEW_USER", "EDIT_USER", "CREATE_USER", "DELETE_USER"]  // Optional list of permission names
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "name": "administrator",
    "description": "System administrator with full access",
    "permissions": [
      {
        "id": 1,
        "name": "VIEW_USER",
        "description": "Allows viewing user details"
      },
      {
        "id": 2,
        "name": "EDIT_USER",
        "description": "Allows editing user details"
      },
      {
        "id": 3,
        "name": "CREATE_USER",
        "description": "Allows creating new users"
      },
      {
        "id": 4,
        "name": "DELETE_USER",
        "description": "Allows deleting users"
      }
    ]
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Role name already exists
  - `400 Bad Request`: Invalid permission names

### 2.2. Get Role Details

- **Method**: GET
- **Endpoint**: `/api/roles/{role_id}`
- **Description**: Retrieves details of a specific role
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "name": "administrator",
    "description": "System administrator with full access",
    "permissions": [
      {
        "id": 1,
        "name": "VIEW_USER",
        "description": "Allows viewing user details"
      },
      {
        "id": 2,
        "name": "EDIT_USER",
        "description": "Allows editing user details"
      }
    ]
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Role not found

### 2.3. List Roles (with Pagination, Sorting, and Filtering)

- **Method**: GET
- **Endpoint**: `/api/roles/`
- **Description**: Returns paginated list of roles with optional filtering and sorting
- **Query Parameters**:
  - `page` (required, default: 1): Current page number
  - `pageSize` (required, default: 10, max: 100): Items per page
  - `sortField` (optional): Field to sort by ('id', 'name', 'description')
  - `sortOrder` (optional): Sort direction ('asc' or 'desc')
  - `filterField[]` (optional): Fields to filter on (can be specified multiple times)
  - `filterValue[]` (optional): Values to filter with (corresponds to filterField)
  - `filterOperator[]` (optional): Operators to use for filtering (corresponds to filterField)
- **Filter Operators**:
  - `eq`: Equal to
  - `neq`: Not equal to
  - `gt`: Greater than
  - `gte`: Greater than or equal to
  - `lt`: Less than
  - `lte`: Less than or equal to
  - `contains`: Contains substring (default if not specified)
  - `startswith`: Starts with
  - `endswith`: Ends with
- **Example Query**: `/api/roles/?page=1&pageSize=10&filterField=name&filterValue=admin&filterOperator=contains&sortField=id&sortOrder=desc`
- **Response**: `200 OK`
  ```json
  {
    "items": [
      {
        "id": 2,
        "name": "super_admin",
        "description": "Super administrator role",
        "permissions": [
          {
            "id": 1,
            "name": "VIEW_USER",
            "description": "Allows viewing user details"
          }
        ]
      },
      {
        "id": 1,
        "name": "administrator",
        "description": "System administrator with full access",
        "permissions": [
          {
            "id": 1,
            "name": "VIEW_USER",
            "description": "Allows viewing user details"
          },
          {
            "id": 2,
            "name": "EDIT_USER",
            "description": "Allows editing user details"
          }
        ]
      }
    ],
    "total": 2,
    "page": 1,
    "pageSize": 10
  }
  ```

### 2.4. Update Role

- **Method**: PUT
- **Endpoint**: `/api/roles/{role_id}`
- **Description**: Updates an existing role
- **Request Body**:
  ```json
  {
    "name": "updated_admin_role",  // Optional
    "description": "Updated description",  // Optional
    "permissions": ["VIEW_USER", "EDIT_USER"]  // Optional, will replace existing permissions
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "name": "updated_admin_role",
    "description": "Updated description",
    "permissions": [
      {
        "id": 1,
        "name": "VIEW_USER",
        "description": "Allows viewing user details"
      },
      {
        "id": 2,
        "name": "EDIT_USER",
        "description": "Allows editing user details"
      }
    ]
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Role not found
  - `400 Bad Request`: Role name already exists
  - `400 Bad Request`: Invalid permission names

### 2.5. Delete Role

- **Method**: DELETE
- **Endpoint**: `/api/roles/{role_id}`
- **Description**: Removes a role from the system
- **Response**: `200 OK`
  ```json
  {
    "detail": "Role deleted"
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Role not found
  - `400 Bad Request`: Cannot delete role as it is assigned to users

## Multiple Filtering Example

You can apply multiple filters at once for both users and roles by specifying multiple filter parameters:

```
GET /api/users/?page=1&pageSize=20&filterField=username&filterValue=john&filterOperator=contains&filterField=email&filterValue=gmail.com&filterOperator=endsWith
```

This request will:
1. Retrieve the first page with 20 items per page
2. Filter users where username contains "john" AND email ends with "gmail.com"

```
GET /api/roles/?page=1&pageSize=20&filterField=name&filterValue=admin&filterOperator=contains&filterField=description&filterValue=access&filterOperator=contains
```

This request will:
1. Retrieve the first page with 20 items per page
2. Filter roles where name contains "admin" AND description contains "access"

## Notes

1. All endpoints require appropriate authentication and authorization
2. All request/response bodies are in JSON format
3. Error responses follow the format:
   ```json
   {
     "detail": "Error message description"
   }
   ```
4. Common HTTP Status Codes:
   - `200 OK`: Request successful
   - `400 Bad Request`: Invalid input or business rule violation
   - `404 Not Found`: Resource not found
   - `500 Internal Server Error`: Server-side error