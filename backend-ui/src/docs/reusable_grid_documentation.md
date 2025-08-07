# Reusable Data Grid Component Documentation

## Overview

The `ReusableDataGrid` component is a configurable and reusable data grid that can be integrated into any part of the application. It provides a standardized way to display tabular data with features like filtering, sorting, and pagination, all connected to a FastAPI backend.

## Features

- Dynamic column configuration
- Server-side filtering, sorting, and pagination
- Support for multiple filter types (text, multiselect, etc.)
- Customizable filter components
- Create, edit, and delete actions
- Responsive design

## Usage

### Basic Implementation

To use the `ReusableDataGrid` component in your component, follow these steps:

1. Import the component:

```jsx
import ReusableDataGrid from '../common/ReusableDataGrid';
```

2. Define your columns configuration:

```jsx
const columns = [
  { field: 'id', headerName: 'ID', width: 70 },
  { field: 'name', headerName: 'Name', flex: 1 },
  // Add more columns as needed
];
```

3. Implement the component in your JSX:

```jsx
<ReusableDataGrid
  title="Your Title"
  columns={columns}
  apiEndpoint="/api/your-endpoint/full"
  initialFilters={yourFilters}
  FiltersComponent={YourFiltersComponent}
  createButtonText="Item"
  onCreateClick={handleCreateClick}
  onEditClick={handleEditClick}
  onDeleteClick={handleDeleteClick}
/>
```

### Complete Example

Here's a complete example of a component using the `ReusableDataGrid`:

```jsx
import React, { useState } from 'react';
import { Box, IconButton, Tooltip } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import ReusableDataGrid from '../common/ReusableDataGrid';
import YourFiltersComponent from './YourFiltersComponent';
import YourFormComponent from './YourFormComponent';
import SERVER_URL from '../common/BackendServerData';

function YourIndexComponent() {
  const [filters, setFilters] = useState({
    field1: '',
    field2: '',
    multiSelectField: []
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Define columns for the grid
  const columns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'field1', headerName: 'Field 1', flex: 1 },
    { field: 'field2', headerName: 'Field 2', flex: 1 },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params) => (
        <Box>
          <Tooltip title="Edit Item">
            <IconButton onClick={() => handleEditClick(params.row)} size="small">
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete Item">
            <IconButton onClick={() => handleDeleteClick(params.row)} size="small" color="error">
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      )
    }
  ];

  // Handle create button click
  const handleCreateClick = () => {
    setSelectedItem(null);
    setFormMode('create');
    setIsFormOpen(true);
  };

  // Handle edit button click
  const handleEditClick = (item) => {
    setSelectedItem(item);
    setFormMode('edit');
    setIsFormOpen(true);
  };

  // Handle delete button click
  const handleDeleteClick = (item) => {
    if (window.confirm(`Are you sure you want to delete this item?`)) {
      fetch(`${SERVER_URL}/api/your-endpoint/${item.id}`, {
        method: 'DELETE',
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`Failed to delete item: ${response.status}`);
          }
          return response.text();
        })
        .then(() => {
          // Refresh the grid after successful deletion
          window.location.reload();
        })
        .catch(err => {
          console.error('Error deleting item:', err);
          alert(`Failed to delete item: ${err.message}`);
        });
    }
  };

  // Handle form close
  const handleFormClose = (refreshData) => {
    setIsFormOpen(false);
    if (refreshData) {
      window.location.reload();
    }
  };

  return (
    <Box sx={{ height: '100%', width: '100%', p: 2 }}>
      <ReusableDataGrid
        title="Your Items"
        columns={columns}
        apiEndpoint="/api/your-endpoint/full"
        initialFilters={filters}
        FiltersComponent={YourFiltersComponent}
        createButtonText="Item"
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      {isFormOpen && (
        <YourFormComponent
          open={isFormOpen}
          onClose={handleFormClose}
          item={selectedItem}
          mode={formMode}
        />
      )}
    </Box>
  );
}

export default YourIndexComponent;
```

## Creating a Filter Component

To create a filter component that works with the `ReusableDataGrid`, follow this pattern:

1. Define your filter types:

```jsx
const FILTER_TYPES = {
  field1: {
    label: 'Field 1',
    type: 'text',
    placeholder: 'Search by field 1'
  },
  field2: {
    label: 'Field 2',
    type: 'text',
    placeholder: 'Search by field 2'
  },
  multiSelectField: {
    label: 'Multi-select Field',
    type: 'multiselect',
    placeholder: 'Filter by multi-select field'
  }
};
```

2. Create your filter component with the required props:

```jsx
function YourFiltersComponent({ filters, onFiltersChange, onSearch }) {
  // Filter component implementation
  // ...

  return (
    <Paper sx={{ p: 2 }}>
      {/* Filter UI */}
      <Button
        variant="contained"
        color="primary"
        onClick={handleSearch}
        startIcon={<SearchIcon />}
      >
        Search
      </Button>
    </Paper>
  );
}
```

## API Reference

### ReusableDataGrid Props

| Prop | Type | Description |
|------|------|-------------|
| `title` | string | The title displayed at the top of the grid |
| `columns` | array | Column definitions for the grid (follows MUI DataGrid column format) |
| `apiEndpoint` | string | API endpoint to fetch data from (should be a relative path, e.g., "/api/users/full") |
| `initialFilters` | object | Initial filter values |
| `FiltersComponent` | React.Component | Custom filter component |
| `createButtonText` | string | Text for the create button |
| `onCreateClick` | function | Function to call when create button is clicked |
| `onEditClick` | function | Function to call when edit button is clicked |
| `onDeleteClick` | function | Function to call when delete button is clicked |
| `defaultPageSize` | number | Default page size (default: 10) |
| `height` | string | Height of the grid (default: 'calc(100vh - 180px)') |

### Filter Component Props

| Prop | Type | Description |
|------|------|-------------|
| `filters` | object | Current filter values |
| `onFiltersChange` | function | Function to call when filters change |
| `onSearch` | function | Function to call when search button is clicked |

## Backend API Requirements

The backend API should support the following query parameters:

- `page`: Page number (1-based)
- `pageSize`: Number of items per page
- `sortField`: Field to sort by
- `sortOrder`: Sort order ('asc' or 'desc')
- `filterField`: Field to filter by (can appear multiple times)
- `filterValue`: Value to filter by (can appear multiple times)
- `filterOperator`: Operator to use for filtering (e.g., 'contains', 'equals')

The API should return data in the following format:

```json
{
  "items": [
    {
      "id": 1,
      "field1": "value1",
      "field2": "value2",
      // other fields
    },
    // more items
  ],
  "total": 100 // total number of items (for pagination)
}
```

## Best Practices

1. **Column Definitions**: Define columns with appropriate widths and flex values for responsive layout.
2. **Filter Components**: Create reusable filter components for each entity type.
3. **Error Handling**: Implement proper error handling in your API calls.
4. **Refresh Strategy**: Consider using a more efficient refresh strategy than `window.location.reload()`.
5. **Confirmation Dialogs**: Use confirmation dialogs for destructive actions like delete.
