# User Filters Backend Implementation Guide

This document provides an overview of how User filtering is implemented in the backend API and how to test these filtering capabilities using the API.

## Backend Filter Implementation

### API Endpoint

The User filtering functionality is exposed through the main users endpoint:

```
GET /api/users/
```

### Filter Parameters Format

The backend API supports two filtering approaches:

#### 1. Modern JSON Filter Format (Recommended)

The modern approach uses a JSON string in the `filters` parameter:

```
GET /api/users/?filters=[{"field":"username","value":"admin","operator":"contains"}]
```

This format supports multiple filters in a single JSON array:

```json
[
  {"field": "username", "value": "admin", "operator": "contains"},
  {"field": "is_active", "value": "true", "operator": "eq"}
]
```

#### 2. Legacy Array Parameters Format

For backward compatibility, the API also supports separate array parameters:

```
GET /api/users/?filter_field[]=username&filter_value[]=admin&filter_operator[]=contains
```

Multiple filters can be specified by adding multiple parameter entries:

```
GET /api/users/?filter_field[]=username&filter_value[]=admin&filter_operator[]=contains&filter_field[]=is_active&filter_value[]=true&filter_operator[]=eq
```

### Available Filter Fields

For User entities, the following fields can be filtered:

| Field Name | Description | Data Type | Example |
|------------|-------------|-----------|---------|
| `username` | User's login name | String | "admin" |
| `email` | User's email address | String | "user@example.com" |
| `is_active` | User's active status | String | "true" or "false" |
| `roles.id` | User's assigned role IDs | Number | 1 |

### Available Filter Operators

| Operator | Description | Applicable Fields |
|----------|-------------|-------------------|
| `contains` | Case-insensitive partial match | `username`, `email` |
| `eq` / `equals` | Exact match | All fields |
| `startsWith` | String starts with value | `username`, `email` |
| `endsWith` | String ends with value | `username`, `email` |
| `in` | Value is in provided list | All fields |
| `gt` | Greater than | Numeric fields |
| `lt` | Less than | Numeric fields |
| `gte` | Greater than or equal | Numeric fields |
| `lte` | Less than or equal | Numeric fields |

### Special Handling for Boolean Fields

The `is_active` field is stored as a boolean in the database but is passed as the string "true" or "false" in filter queries.

### Special Handling for Relationship Fields

When filtering by roles:
- Use `roles.id` as the field name in the JSON filter format
- Use `roles` as the field name in the legacy array format
- Values should be role IDs
- The API will return users who have ANY of the specified roles (OR condition)

## Implementation Details

The backend uses a QueryBuilder pattern for constructing database queries:

1. Filter parameters are parsed from either the JSON format or the legacy array parameters
2. Each filter is converted to a Filter object and validated
3. Special handling is applied for relationship fields like `roles`
4. The QueryBuilder applies all filters, sorting, and pagination
5. Results are returned in a standard paginated format

## Testing in Postman

### Basic Filter Test (JSON Format)

1. **Setup a GET request**:
   - URL: `{{base_url}}/api/users/`
   - Method: GET
   
2. **Add Authorization**:
   - Type: Bearer Token
   - Token: `{{access_token}}`

3. **Filter by Username** (single filter):
   - Add query parameters:
     - `filters`: `[{"field":"username","value":"admin","operator":"contains"}]`

### Multiple Filters Test (JSON Format)

1. **Setup a GET request** as above

2. **Filter by Username AND Status**:
   - Add query parameters:
     - `filters`: `[{"field":"username","value":"admin","operator":"contains"},{"field":"is_active","value":"true","operator":"eq"}]`

### Role Filtering Test (JSON Format)

1. **Setup a GET request** as above

2. **Filter by Role** (users with role ID 1):
   - Add query parameters:
     - `filters`: `[{"field":"roles.id","value":1,"operator":"eq"}]`

### Multiple Role Filtering

1. **Setup a GET request** as above

2. **Filter by Multiple Roles** (users with role ID 1 OR 2):
   - Using JSON format:
     - `filters`: `[{"field":"roles.id","value":1,"operator":"eq"},{"field":"roles.id","value":2,"operator":"eq"}]`
   - Using legacy format:
     - `filter_field[]=roles&filter_value[]=1&filter_operator[]=eq&filter_field[]=roles&filter_value[]=2&filter_operator[]=eq`

### Testing in FastAPI Docs

When testing in the FastAPI docs UI:

1. For JSON filtering, enter the JSON array string in the `filters` parameter
2. For legacy filtering, add items to the parameter arrays using the "+ Add string item" button
3. For multiple role filtering, add multiple `filter_field[]` entries with `roles` as the value but different ID values

### Common Issues and Debugging

If filters aren't working as expected:

1. **Check JSON syntax**: Ensure the JSON array is correctly formatted with double quotes around field names
2. **Check parameter format**: For legacy format, ensure the parameter names include `[]` brackets
3. **Check value types**: Ensure `is_active` is sent as "true" or "false" string (not boolean)
4. **Check role ID format**: Ensure role IDs are sent as numbers (or strings that can be parsed as numbers)
5. **Check authentication**: Verify your token is valid and has not expired
6. **Examine the response body**: Look for error messages that may indicate validation issues

## Example Requests

### JSON Filter Format (Recommended)

```
GET /api/users/?filters=[{"field":"username","value":"admin","operator":"contains"}]
```

```
GET /api/users/?filters=[{"field":"roles.id","value":1,"operator":"eq"},{"field":"is_active","value":"true","operator":"eq"}]
```

### Legacy Array Format

```
GET /api/users/?filter_field[]=username&filter_value[]=admin&filter_operator[]=contains
```

```
GET /api/users/?filter_field[]=roles&filter_value[]=1&filter_operator[]=eq&filter_field[]=is_active&filter_value[]=true&filter_operator[]=eq
```

### With Pagination and Sorting

```
GET /api/users/?filters=[{"field":"email","value":"example.com","operator":"contains"}]&page=1&page_size=25&sort_field=created_at&sort_order=desc
``` 