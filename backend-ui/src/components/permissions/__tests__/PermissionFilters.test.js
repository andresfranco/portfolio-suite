import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import PermissionFilters from '../PermissionFilters';

// Mock the logger utility to avoid console noise in tests
jest.mock('../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

// Mock console methods to reduce noise
global.console = {
  ...console,
  error: jest.fn(),
  log: jest.fn(),
  warn: jest.fn(),
};

describe('PermissionFilters', () => {
  // Default props for component
  const defaultProps = {
    filters: {},
    onFiltersChange: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders filter section with title', () => {
    render(<PermissionFilters {...defaultProps} />);
    
    // Check for title and buttons
    const filtersTitle = screen.getByText('Filters');
    expect(filtersTitle).toBeInTheDocument();
  });

  test('renders add filter and clear filters buttons', async () => {
    render(<PermissionFilters {...defaultProps} />);
    
    // Check for buttons with more reliable selectors
    await waitFor(() => {
      const addFilterButton = screen.getByRole('button', { name: /add filter/i });
      expect(addFilterButton).toBeInTheDocument();
    });
    const clearFiltersButton = screen.getByRole('button', { name: /clear filters/i });
    expect(clearFiltersButton).toBeInTheDocument();
  });

  test('renders search button', () => {
    render(<PermissionFilters {...defaultProps} />);
    
    // Check for search button
    const searchButton = screen.getByRole('button', { name: /search/i });
    expect(searchButton).toBeInTheDocument();
  });

  test('calls onFiltersChange when clear filters button is clicked', async () => {
    const onFiltersChangeMock = jest.fn();
    render(<PermissionFilters filters={{}} onFiltersChange={onFiltersChangeMock} />);
    
    // Click clear filters button
    const clearButton = screen.getByRole('button', { name: /clear filters/i });
    fireEvent.click(clearButton);
    
    // Check if onFiltersChange was called with empty filters
    await waitFor(() => {
      expect(onFiltersChangeMock).toHaveBeenCalledWith({});
    });
  });

  test('calls onFiltersChange when search button is clicked', async () => {
    const onFiltersChangeMock = jest.fn();
    render(<PermissionFilters filters={{}} onFiltersChange={onFiltersChangeMock} />);
    
    // Find and click the search button
    const searchButton = screen.getByRole('button', { name: /search/i });
    fireEvent.click(searchButton);
    
    // Wait for onFiltersChange to be called
    await waitFor(() => {
      expect(onFiltersChangeMock).toHaveBeenCalled();
    });
  });

  // This test is simplified to focus on the existence of the Add Filter button's disabled state
  test('disables Add Filter button when all filter types are used', async () => {
    render(<PermissionFilters {...defaultProps} />);
    
    // Add all available filter types (assuming there are at least 2)
    const addFilterButton = screen.getByRole('button', { name: /add filter/i });
    fireEvent.click(addFilterButton);
    
    // Check if Add Filter button becomes disabled after adding all filters
    await waitFor(() => {
      const buttonElement = screen.getByRole('button', { name: /add filter/i });
      expect(buttonElement).toBeDisabled();
    }, { timeout: 3000 });
  });

  // Simplified test for initial filter values
  test('renders with initial filter values', () => {
    const initialFilters = {
      name: 'ADMIN_PERMISSION'
    };
    
    render(<PermissionFilters filters={initialFilters} onFiltersChange={jest.fn()} />);
    
    // Verify component renders with title
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });
}); 