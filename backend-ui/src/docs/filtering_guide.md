# Filtering Guide

This guide explains how to use the filtering capabilities in the Portfolio Backend UI across all modules.

## General Filtering Format

The API supports filtering through query parameters using special filter parameters.

### Filter Parameters

- `filter_field`: The field to filter on (can be multiple)
- `filter_value`: The value to filter by (can be multiple)
- `filter_operator`: The operator to use (can be multiple)

### Supported Operators

The following operators are supported for filtering:
- `contains` (default): Case-insensitive partial match
- `equals` (or `eq`): Exact match
- `startsWith`: Case-insensitive prefix match
- `endsWith`: Case-insensitive suffix match
- `in`: Values are in a list (used for multi-value filters)
- `gt`: Greater than
- `lt`: Less than
- `gte`: Greater than or equal
- `lte`: Less than or equal
- `neq`: Not equal to
- `notin`: Values not in a list

## Frontend Implementation

### Filter Component Structure

A standard filter component should use:
- React Hook Form for managing filter inputs
- Material UI components for the user interface
- State persistence across re-renders using a persistent store

Key features to implement:
1. Define filterable fields in a FILTER_TYPES object with appropriate labels, types, and placeholders
2. Support dynamic addition and removal of filters
3. Implement auto-submission when fields are cleared
4. Set up persistent filters state across component re-renders
5. Support specific filter types (text, select, multi-select, autocomplete, etc.)

### Filter Component Implementation

To implement a filter component for a module:

1. Create a FILTER_TYPES object defining available filters:
```javascript
const FILTER_TYPES = {
  name: {
    label: 'Name',
    type: 'text',
    placeholder: 'Search by name'
  },
  description: {
    label: 'Description',
    type: 'text',
    placeholder: 'Search by description'
  },
  // Add other filterable fields specific to the module
};
```

2. Implement the filter component with these key features:
   - A persistent store to maintain state between re-renders
   - State management for active filters
   - Form handling using react-hook-form
   - Methods for adding, removing, and changing filter types
   - Submission handling to process and clean filters
   - UI for filter display, selection, and submission

### Filter Workflow

1. The Filter component captures user inputs
2. When submitted (manually or auto-submitted), filters are processed to:
   - Remove empty filters
   - Format special filters (like arrays or objects)
   - Create a clean filters object
3. The filter values are passed to the parent component via `onFilterChange` callback
4. The parent component passes filters to the Context provider
5. The Context's update method transforms filters to the backend format
6. An API call is made with the transformed filters
7. Backend processes filter parameters and returns filtered results

### Filter API Transformation

Filters are transformed from object format:
```javascript
{
  name: "admin",
  is_active: "true"
}
```

To the array format expected by the backend:
```javascript
{
  filter_field: ["name", "is_active"],
  filter_value: ["admin", "true"],
  filter_operator: ["contains", "contains"]
}
```

Alternatively, for more complex filtering needs, filters can be transformed to a JSON string representing an array of filter objects:
```javascript
filters: JSON.stringify([
  { field: "name", value: "admin", operator: "contains" },
  { field: "is_active", value: "true", operator: "equals" }
])
```

## Backend Implementation

### API Endpoint Structure

Backend endpoints should support the following query parameters:
- `page`: Page number (1-indexed)
- `page_size`: Number of items per page
- `filters`: Either query parameters or a JSON string of filter objects
- `sort_field`: Field to sort by
- `sort_order`: Sort direction ('asc' or 'desc')

### Filter Processing

The backend processes filters in two ways:

1. **Query Parameter Format**:
```
/api/entities/?filter_field=name&filter_value=admin&filter_operator=contains
```

2. **JSON String Format**:
```
/api/entities/?filters=[{"field":"name","value":"admin","operator":"contains"}]
```

### Backend Filter Implementation

1. A helper function parses the filter string to a list of filter objects:
```python
def parse_filters(filters_json: Optional[str]) -> Optional[List[Dict[str, Any]]]:
    if not filters_json:
        return None
        
    try:
        filters_list = json.loads(filters_json)
        if not isinstance(filters_list, list):
            raise ValueError("Filters must be a JSON array")
        
        # Validate each filter dictionary
        validated_filters = []
        for f in filters_list:
            validated_filter = {
                'field': f['field'],
                'value': f['value'],
                'operator': f.get('operator', 'contains')
            }
            validated_filters.append(validated_filter)
            
        return validated_filters
    except (json.JSONDecodeError, ValueError) as e:
        raise HTTPException(status_code=400, detail=str(e))
```

2. The API endpoint receives filter parameters:
```python
@router.get("/", response_model=PaginatedEntityResponse)
def read_entities(
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    filters: Optional[str] = Query(None),
    sort_field: Optional[str] = Query(None),
    sort_order: Optional[str] = Query("asc", pattern="^(asc|desc)$")
):
    parsed_filters = parse_filters(filters)
    
    # Get paginated entities
    entities, total = crud_entity.get_entities_paginated(
        db=db,
        page=page,
        page_size=page_size,
        filters=parsed_filters,
        sort_field=sort_field,
        sort_order=sort_order
    )
    
    response = {
        "items": entities, 
        "total": total,
        "page": page,
        "page_size": page_size
    }
    
    return response
```

3. A CRUD function applies the filters to the query:
```python
def get_entities_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    filters: Optional[List[Filter]] = None,
    sort_field: Optional[str] = None,
    sort_order: Optional[str] = "asc"
) -> Tuple[List[Entity], int]:
    # Create base query
    query = db.query(Entity)
    
    # Initialize QueryBuilder
    builder = QueryBuilder(
        query_or_model=query,
        model=Entity,
        db_session=db
    )
    
    # Apply filters if provided
    if filters:
        builder.apply_filters(filters)
    
    # Apply sorting
    builder.apply_sort(sort_field or 'name', sort_order)
    
    # Calculate offset
    offset = (page - 1) * page_size
    
    # Get total count
    total = builder.get_count()
    
    # Apply pagination
    results = builder.get_query().offset(offset).limit(page_size).all()
    
    return results, total
```

## Special Filtering Cases

### Relation Filtering

For filtering by related entities (e.g., filtering roles by permissions), some modifications are required:

1. On the frontend, extract the relation values and send them as a separate parameter:
```javascript
// Handle permissions directly
if (queryParams.permissions && Array.isArray(queryParams.permissions)) {
  const processedPermissions = queryParams.permissions.map(perm => 
    typeof perm === 'string' ? perm : (perm.name || perm.id || String(perm))
  );
  
  if (processedPermissions.length > 0) {
    queryParams.relation_names = processedPermissions.join(',');
  }
  
  // Remove from regular filters
  delete queryParams.permissions;
}
```

2. On the backend, parse the relation parameter and add it to filters:
```python
# Add relation_names to filters if provided
if relation_names:
    # Split by comma and strip whitespace
    relation_list = [r.strip() for r in relation_names.split(',') if r.strip()]
    
    if not parsed_filters:
        parsed_filters = []
        
    # Add as a relation filter
    if relation_list:
        parsed_filters.append({
            'field': 'relation_field',
            'value': relation_list,
            'operator': 'in'
        })
```

## Using Filters in the UI

### Basic Usage

1. Use the filter form to add criteria relevant to the module
2. Press Enter or click "Search" to apply filters
3. Click "Add Filter" to add more filter criteria
4. Click "Clear Filters" to reset all filters

### Filter Response Format

Filtered responses from the backend include:
```json
{
  "items": [
    // Array of filtered items matching the criteria
  ],
  "total": total_count,
  "page": current_page,
  "page_size": items_per_page
}
```

## Best Practices

1. Use appropriate operators for different filtering needs:
   - `contains` for partial text matches
   - `equals` for exact matches
   - `startsWith`/`endsWith` for prefix/suffix matches
   - `in` for multiple value options

2. Combine multiple filters for more precise queries
3. Implement relation filtering for filtering by related entities
4. Clear filters when switching between modules to avoid unexpected results
5. Ensure proper error handling for malformed filters
6. Validate filter values on both frontend and backend
7. Keep filter UI consistent across modules