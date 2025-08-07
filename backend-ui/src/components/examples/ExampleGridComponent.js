import React, { useState } from 'react';
import { Box, IconButton, Tooltip, Paper, TextField, Button } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Search as SearchIcon } from '@mui/icons-material';
import ReusableDataGrid from '../common/ReusableDataGrid';
import SERVER_URL from '../../common/BackendServerData';

// Example filter component
function ExampleFilters({ filters, onFiltersChange, onSearch }) {
  const handleChange = (e) => {
    const { name, value } = e.target;
    onFiltersChange({
      ...filters,
      [name]: value
    });
  };

  return (
    <Paper sx={{ p: 2, mb: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
        <TextField
          label="Name"
          name="name"
          value={filters.name || ''}
          onChange={handleChange}
          variant="outlined"
          size="small"
          placeholder="Search by name"
        />
        <TextField
          label="Category"
          name="category"
          value={filters.category || ''}
          onChange={handleChange}
          variant="outlined"
          size="small"
          placeholder="Filter by category"
        />
      </Box>
      <Box>
        <Button
          variant="contained"
          color="primary"
          onClick={onSearch}
          startIcon={<SearchIcon />}
        >
          Search
        </Button>
      </Box>
    </Paper>
  );
}

// Example form component (for create/edit)
function ExampleForm({ open, onClose, item, mode }) {
  // This would be implemented with a modal dialog and form fields
  // For this example, we're just showing the structure
  console.log('Form opened with item:', item, 'in mode:', mode);
  return null;
}

// Main example component using the reusable grid
function ExampleGridComponent() {
  const [filters, setFilters] = useState({
    name: '',
    category: ''
  });

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formMode, setFormMode] = useState(null);
  const [selectedItem, setSelectedItem] = useState(null);

  // Define columns for the grid
  const columns = [
    { field: 'id', headerName: 'ID', width: 70 },
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'category', headerName: 'Category', flex: 1 },
    { field: 'price', headerName: 'Price', width: 120 },
    { field: 'stock', headerName: 'Stock', width: 120 },
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
    if (window.confirm(`Are you sure you want to delete ${item.name}?`)) {
      // In a real application, this would be an API call
      console.log('Deleting item:', item);
      alert('Delete functionality would be implemented with a real API endpoint');
      
      // Example of how the API call would look:
      /*
      fetch(`${SERVER_URL}/api/products/${item.id}`, {
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
      */
    }
  };

  // Handle form close
  const handleFormClose = (refreshData) => {
    setIsFormOpen(false);
    if (refreshData) {
      // In a real application, this would refresh the data
      console.log('Refreshing data after form submission');
    }
  };

  return (
    <Box sx={{ height: '100%', width: '100%', p: 2 }}>
      <ReusableDataGrid
        title="Example Products"
        columns={columns}
        apiEndpoint="/api/products/full" // This would be a real endpoint in a production app
        initialFilters={filters}
        FiltersComponent={ExampleFilters}
        createButtonText="Product"
        onCreateClick={handleCreateClick}
        onEditClick={handleEditClick}
        onDeleteClick={handleDeleteClick}
      />

      {isFormOpen && (
        <ExampleForm
          open={isFormOpen}
          onClose={handleFormClose}
          item={selectedItem}
          mode={formMode}
        />
      )}
    </Box>
  );
}

export default ExampleGridComponent;
