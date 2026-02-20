import { Box, Paper,Typography,Button,Tooltip,Stack } from '@mui/material';
import { DataGrid,GridToolbarQuickFilter,GridToolbarFilterButton } from '@mui/x-data-grid';
import {Add as AddIcon} from '@mui/icons-material';

// Generic toolbar that can be customized based on props
const CustomToolbar = ({ 
  onCreateClick, 
  createButtonText, 
  showQuickFilter = true,
  filters = null,
  onFiltersChange = null,
  onSearch = null,
  CustomFilterComponent = null
}) => {
  
  // Function to handle search button click
  const handleSearchClick = () => {
    if (onSearch) {
      onSearch();
    }
  };
  
  // Function to handle filter changes
  const handleFiltersChange = (newFilters) => {
    if (onFiltersChange) {
      onFiltersChange(newFilters);
    }
  };
  
  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Tooltip title={`Create new ${createButtonText.toLowerCase()}`} arrow placement="right">
            <Button
              startIcon={<AddIcon />}
              variant="contained"
              color="primary"
              size="large"
              onClick={onCreateClick}
              sx={{
                boxShadow: 2,
                backgroundColor: 'primary.dark',
                '&:hover': {
                  backgroundColor: 'primary.dark',
                  boxShadow: 4,
                },
                fontWeight: 'bold',
                px: 3,
                py: 1
              }}
            >
              {`New ${createButtonText}`}
            </Button>
          </Tooltip>
          
          {showQuickFilter && !CustomFilterComponent && (
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1, maxWidth: 500, ml: 2 }}>
              <GridToolbarQuickFilter 
                fullWidth
                variant="outlined"
                size="small"
                placeholder="Search in all columns..."
                sx={{ 
                  mt: 0,
                  '& .MuiInputBase-root': {
                    backgroundColor: 'background.paper',
                  }
                }}
              />
              <GridToolbarFilterButton />
            </Box>
          )}
        </Box>

        {CustomFilterComponent && (
          <CustomFilterComponent 
            filters={filters}
            onFiltersChange={handleFiltersChange}
            onSearch={handleSearchClick}
          />
        )}
      </Stack>
    </Box>
  );
};

function GenericDataGrid({
  title,
  rows,
  columns,
  loading = false,
  totalRows,
  createButtonText,
  onCreateClick,
  paginationModel,
  onPaginationModelChange,
  sortModel,
  onSortModelChange,
  showQuickFilter = true,
  CustomFilterComponent = null,
  filters = null,
  onFiltersChange = null,
  onSearch = null,
  paginationMode = "client",
  sortingMode = "client",
  filterMode = "client",
  pageSizeOptions = [5, 10, 20],
  height = 'calc(100vh - 180px)'
}) {
  return (
    <Box sx={{ height: '100%', width: '100%' }}>
      {title && (
        <Typography variant="h5" component="h2" gutterBottom>
          {title}
        </Typography>
      )}
      <Paper sx={{ height, width: '100%' }}>
        <DataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          rowCount={totalRows || rows.length}
          pageSizeOptions={pageSizeOptions}
          paginationMode={paginationMode}
          sortingMode={sortingMode}
          filterMode={filterMode}
          paginationModel={paginationModel}
          onPaginationModelChange={onPaginationModelChange}
          sortModel={sortModel}
          onSortModelChange={onSortModelChange}
          slots={{
            toolbar: CustomToolbar,
          }}
          slotProps={{
            toolbar: {
              onCreateClick,
              createButtonText,
              showQuickFilter,
              CustomFilterComponent,
              filters,
              onFiltersChange,
              onSearch
            }
          }}
          autoHeight
          getRowHeight={() => 'auto'}
          sx={{
            '& .MuiDataGrid-columnHeaders': {
              backgroundColor: 'primary.main',
              color: 'primary.contrastText',
            },
            '& .MuiDataGrid-cell:hover': {
              color: 'primary.main',
            },
            '& .MuiDataGrid-row': {
              minHeight: '48px !important'
            }
          }}
        />
      </Paper>
    </Box>
  );
}

export default GenericDataGrid;