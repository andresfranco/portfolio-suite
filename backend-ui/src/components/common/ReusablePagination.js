import React from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import { KeyboardArrowLeft, KeyboardArrowRight } from '@mui/icons-material';

/**
 * Reusable pagination component matching the design used across modules.
 *
 * @param {Object} props
 * @param {{page:number,pageSize:number,total:number}} props.pagination - Current pagination data
 * @param {Function} props.onPaginationChange - Callback when page or page size changes
 * @param {number[]} [props.pageSizeOptions=[5,10,15,20,25]] - Available page size options
 */
function ReusablePagination({ pagination, onPaginationChange, pageSizeOptions = [5,10,15,20,25] }) {
  // Safeguard pagination values
  const safePagination = {
    page: Math.max(0, pagination?.page || 0),
    pageSize: Math.max(1, pagination?.pageSize || 10),
    total: Math.max(0, pagination?.total || 0)
  };

  const handleChangePageSize = (e) => {
    const newSize = parseInt(e.target.value, 10);
    console.log('ReusablePagination - Page size change:', {
      oldPageSize: safePagination.pageSize,
      newPageSize: newSize,
      currentPage: safePagination.page,
      total: safePagination.total
    });
    
    if (onPaginationChange) {
      // Reset to first page when changing page size
      const newPaginationModel = { page: 0, pageSize: newSize };
      console.log('ReusablePagination - Calling onPaginationChange with:', newPaginationModel);
      onPaginationChange(newPaginationModel);
    }
  };

  const handlePrevPage = () => {
    if (safePagination.page > 0 && onPaginationChange) {
      onPaginationChange({ ...safePagination, page: safePagination.page - 1 });
    }
  };

  const handleNextPage = () => {
    console.log('handleNextPage called:', {
      currentPage: safePagination.page,
      lastPageIndex,
      canGoNext: safePagination.page < lastPageIndex
    });
    
    if (safePagination.page < lastPageIndex && onPaginationChange) {
      onPaginationChange({ ...safePagination, page: safePagination.page + 1 });
    }
  };

  const start = safePagination.total > 0 ? safePagination.page * safePagination.pageSize + 1 : 0;
  const end = safePagination.total > 0 ? Math.min((safePagination.page + 1) * safePagination.pageSize, safePagination.total) : 0;
  const totalPages = Math.ceil(safePagination.total / safePagination.pageSize);
  const lastPageIndex = totalPages - 1; // 0-indexed last page
  const isFirstPage = safePagination.page === 0;
  const isLastPage = safePagination.page >= lastPageIndex;

  // Debug logging
  console.log('ReusablePagination debug:', {
    safePagination,
    totalPages,
    lastPageIndex,
    isFirstPage,
    isLastPage,
    start,
    end
  });

  return (
    <Box sx={{ display:'flex', alignItems:'center', justifyContent:'flex-end', backgroundColor:'transparent', height:'52px', padding:'0 24px' }}>
      <Typography variant="body2" sx={{ color:'rgba(0,0,0,0.6)', fontSize:'0.8125rem', mr:1 }}>
        Rows per page:
      </Typography>
      <select
        value={safePagination.pageSize}
        onChange={handleChangePageSize}
        style={{
          marginRight:'24px',
          padding:'4px 24px 4px 8px',
          border:'none',
          borderRadius:'4px',
          backgroundColor:'transparent',
          color:'rgba(0,0,0,0.6)',
          fontSize:'0.8125rem',
          cursor:'pointer',
          appearance:'menulist'
        }}
      >
        {pageSizeOptions.map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      <Typography variant="body2" sx={{ color:'rgba(0,0,0,0.6)', fontSize:'0.8125rem', minWidth:'100px', textAlign:'center' }}>
        {safePagination.total === 0 ? '0-0 of 0' : `${start}-${end} of ${safePagination.total}`}
      </Typography>
      <Box sx={{ display:'flex', ml:2 }}>
        <IconButton onClick={handlePrevPage} disabled={isFirstPage} size="small" sx={{ color: isFirstPage ? 'rgba(0,0,0,0.26)' : 'rgba(0,0,0,0.54)', padding:'6px' }}>
          <KeyboardArrowLeft />
        </IconButton>
        <IconButton onClick={handleNextPage} disabled={isLastPage} size="small" sx={{ color: isLastPage ? 'rgba(0,0,0,0.26)' : 'rgba(0,0,0,0.54)', padding:'6px' }}>
          <KeyboardArrowRight />
        </IconButton>
      </Box>
    </Box>
  );
}

export default ReusablePagination;
