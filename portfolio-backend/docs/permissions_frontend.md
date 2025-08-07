# Permissions API Specification

This document outlines the available API endpoints for managing permissions in the system. All endpoints are prefixed with `/api/permissions`.

## 1. Create Permission

- **Method**: POST
- **Endpoint**: `/api/permissions/`
- **Description**: Creates a new permission in the system
- **Request Body**:
  ```json
  {
    "name": "CREATE_USER",
    "description": "Allows creating new users"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "name": "CREATE_USER",
    "description": "Allows creating new users"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Permission already exists

## 2. List Permissions

### 2.1 Simple List
- **Method**: GET
- **Endpoint**: `/api/permissions/`
- **Description**: Returns a simple list of all permission names
- **Response**: `200 OK`
  ```json
  [
    "CREATE_USER",
    "EDIT_USER",
    "DELETE_USER",
    "VIEW_USER"
  ]
  ```

### 2.2 Full Details List
- **Method**: GET
- **Endpoint**: `/api/permissions/full`
- **Description**: Returns paginated list of permissions with full details
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
- **Example Query**: `/api/permissions/full?page=1&pageSize=10&filterField=name&filterValue=USER&filterOperator=contains&sortField=id&sortOrder=desc`
- **Response**: `200 OK`
  ```json
  {
    "items": [
      {
        "id": 1,
        "name": "CREATE_USER",
        "description": "Allows creating new users"
      }
    ],
    "total": 10,
    "page": 1,
    "pageSize": 10
  }
  ```

## 3. Get Permission Details

- **Method**: GET
- **Endpoint**: `/api/permissions/{permission_id}`
- **Description**: Retrieves details of a specific permission
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "name": "CREATE_USER",
    "description": "Allows creating new users"
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Permission not found

## 4. Update Permission

- **Method**: PUT
- **Endpoint**: `/api/permissions/{permission_id}`
- **Description**: Updates an existing permission
- **Request Body**:
  ```json
  {
    "name": "CREATE_USER",
    "description": "Updated description for creating users"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": 1,
    "name": "CREATE_USER",
    "description": "Updated description for creating users"
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Permission not found
  - `400 Bad Request`: Permission name already exists (when trying to change name to an existing one)

## 5. Delete Permission

- **Method**: DELETE
- **Endpoint**: `/api/permissions/{permission_id}`
- **Description**: Removes a permission from the system
- **Response**: `200 OK`
  ```json
  {
    "detail": "Permission deleted"
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Permission not found
  - `400 Bad Request`: Cannot delete permission as it is assigned to roles

## Multiple Filtering Example

You can apply multiple filters at once by specifying multiple filter parameters:

```
GET /api/permissions/full?page=1&pageSize=20&filterField=name&filterValue=USER&filterOperator=contains&filterField=id&filterValue=5&filterOperator=gt
```

This request will:
1. Retrieve the first page with 20 items per page
2. Filter permissions where name contains "USER" AND id is greater than 5

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

## Core Permission Set

The system implements the following core permissions:
- `CREATE_USER`: Allows creating new users
- `EDIT_USER`: Allows editing user details
- `DELETE_USER`: Allows deleting users
- `VIEW_USER`: Allows viewing user details
- `CREATE_ROLE`: Allows creating new roles
- `EDIT_ROLE`: Allows editing role details
- `DELETE_ROLE`: Allows deleting roles
- `VIEW_ROLE`: Allows viewing role details