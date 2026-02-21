# Filtering Guide

This guide explains how to use the filtering capabilities in the Portfolio Backend API.

## General Filtering Format

The API supports filtering through query parameters using query parameters for fields, values, and operators. 

### Filter Parameters

- `filterField`: The field to filter on (can be multiple)
- `filterValue`: The value to filter by (can be multiple)
- `filterOperator`: The operator to use (can be multiple)

### Supported Operators

The following operators are supported for filtering:
- `contains` (default): Case-insensitive partial match
- `equals`: Exact match
- `startsWith`: Case-insensitive prefix match
- `endsWith`: Case-insensitive suffix match

## Database Structure

### Users Table
- `id`: Integer (Primary Key)
- `username`: String (Unique)
- `email`: String (Unique)
- `roles`: Many-to-many relationship with Roles table

### Roles Table
- `id`: Integer (Primary Key)
- `name`: String (Unique)
- `description`: String

The relationship between Users and Roles is many-to-many, implemented through a junction table `user_roles`.

## Using Filters in Requests

Example requests:

1. Filter users by username containing "john":
```
/api/users/?filterField=username&filterValue=john&filterOperator=contains
```

2. Filter users by exact email match:
```
/api/users/?filterField=email&filterValue=john@example.com&filterOperator=equals
```

3. Multiple filters (users with username containing "john" AND email ending with "gmail.com"):
```
/api/users/?filterField=username&filterValue=john&filterOperator=contains&filterField=email&filterValue=gmail.com&filterOperator=endsWith
```

## Pagination and Sorting

Filtering can be combined with pagination and sorting:

### Pagination Parameters
- `page`: Current page number (1-based, default: 1)
- `pageSize`: Number of items per page (default: 10, max: 100)

### Sorting Parameters
- `sortField`: Column to sort by (e.g., "id", "username", "email")
- `sortOrder`: Sort direction ("asc" or "desc")

Example with filtering, pagination, and sorting:
```
/api/users/?page=1&pageSize=10&filterField=username&filterValue=john&sortField=email&sortOrder=asc
```

## Response Format

Filtered responses include:
```json
{
  "items": [
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
  "total": total_count,
  "page": current_page,
  "pageSize": items_per_page
}
```

## Best Practices

1. URL encode filter parameters to handle special characters
2. Use appropriate operators for different filtering needs:
   - `contains` for partial matches
   - `equals` for exact matches
   - `startsWith`/`endsWith` for prefix/suffix matches
3. Use pagination to handle large result sets
4. Consider combining filters for more precise queries

## Role-Based Filtering

Currently, direct filtering on roles is not implemented in the backend. To filter users by roles, you would need to:

1. First fetch the roles using the `/roles` endpoint
2. Then use the role IDs to filter users through the user management endpoints
3. The roles are included in the user response objects, allowing client-side filtering if needed

Note: If you need to filter by roles directly, you'll need to implement additional backend functionality to support this feature.