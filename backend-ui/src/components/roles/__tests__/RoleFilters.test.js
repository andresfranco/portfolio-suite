import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import RoleFilters from '../RoleFilters';
import roleApi from '../../../services/roleApi';

// Mock the roleApi module
jest.mock('../../../services/roleApi', () => ({
  getAllPermissionNames: jest.fn()
}));

// Mock logger
jest.mock('../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn()
}));

describe('RoleFilters', () => {
  const mockPermissions = ['CREATE_USER', 'EDIT_USER', 'DELETE_USER', 'VIEW_DASHBOARD'];
  
  // Setup mock filters using the new filter structure
  const mockFilters = [
    { field: 'name', value: 'Admin', operator: 'contains' }
  ];
  
  const onFiltersChangeMock = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock the API to return permissions
    roleApi.getAllPermissionNames.mockResolvedValue(mockPermissions);
  });
  
  test('renders with initial filter for name field', async () => {
    render(<RoleFilters filters={[]} onFiltersChange={onFiltersChangeMock} />);
    
    // Check filter type select is present
    expect(screen.getByLabelText('Field')).toBeInTheDocument();
    expect(screen.getByLabelText('Field')).toHaveValue('name');
    
    // Check operator select is present
    expect(screen.getByLabelText('Operator')).toBeInTheDocument();
    expect(screen.getByLabelText('Operator')).toHaveValue('contains');
    
    // Check filter value input is present (Role Name)
    expect(screen.getByLabelText('Role Name')).toBeInTheDocument();
  });
  
  test('renders with existing filters', async () => {
    render(<RoleFilters filters={mockFilters} onFiltersChange={onFiltersChangeMock} />);
    
    // Check filter value has the correct preset value
    expect(screen.getByLabelText('Role Name')).toHaveValue('Admin');
  });
  
  test('adds a new filter when add button is clicked', async () => {
    const user = userEvent.setup();
    render(<RoleFilters filters={mockFilters} onFiltersChange={onFiltersChangeMock} />);
    
    const addButton = screen.getByRole('button', { name: /add filter criterion/i });
    await user.click(addButton);
    
    // Now we should see two filters
    const fieldSelects = screen.getAllByLabelText('Field');
    expect(fieldSelects).toHaveLength(2);
    
    // The new filter should default to a field that's not already used
    expect(fieldSelects[1]).not.toHaveValue('name');
  });
  
  test('changes filter type and updates filters', async () => {
    const user = userEvent.setup();
    render(<RoleFilters filters={mockFilters} onFiltersChange={onFiltersChangeMock} />);
    
    // Add a new filter
    const addButton = screen.getByRole('button', { name: /add filter criterion/i });
    await user.click(addButton);
    
    // Get the field selects
    const fieldSelects = screen.getAllByLabelText('Field');
    
    // Change the new filter to "description"
    await user.click(fieldSelects[1]);
    const descriptionOption = screen.getByRole('option', { name: 'Description' });
    await user.click(descriptionOption);
    
    // Enter a value in the description filter
    const descriptionInput = screen.getByLabelText('Description');
    await user.type(descriptionInput, 'Administrator');
    
    // The onFiltersChange should have been called with updated filters
    expect(onFiltersChangeMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ field: 'name', value: 'Admin' }),
      expect.objectContaining({ field: 'description', value: 'Administrator' })
    ]));
  });
  
  test('changes operator and updates filters', async () => {
    const user = userEvent.setup();
    render(<RoleFilters filters={mockFilters} onFiltersChange={onFiltersChangeMock} />);
    
    // Get the operator select
    const operatorSelect = screen.getByLabelText('Operator');
    
    // Change the operator to "equals"
    await user.click(operatorSelect);
    const equalsOption = screen.getByRole('option', { name: 'Equals' });
    await user.click(equalsOption);
    
    // The onFiltersChange should have been called with updated operator
    expect(onFiltersChangeMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ field: 'name', operator: 'eq' })
    ]));
  });
  
  test('removes a filter when remove button is clicked', async () => {
    const user = userEvent.setup();
    
    // Start with two filters
    const twoFilters = [
      { field: 'name', value: 'Admin', operator: 'contains' },
      { field: 'description', value: 'Administrator', operator: 'contains' }
    ];
    
    render(<RoleFilters filters={twoFilters} onFiltersChange={onFiltersChangeMock} />);
    
    // Find the remove button for the second filter
    const removeButtons = screen.getAllByRole('button', { name: /remove filter/i });
    await user.click(removeButtons[1]);
    
    // The onFiltersChange should have been called with just the first filter
    expect(onFiltersChangeMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ field: 'name', value: 'Admin' })
    ]));
    
    // And not with the second filter
    expect(onFiltersChangeMock).not.toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ field: 'description', value: 'Administrator' })
    ]));
  });
  
  test('clears all filters when clear filters button is clicked', async () => {
    const user = userEvent.setup();
    
    // Start with two filters
    const twoFilters = [
      { field: 'name', value: 'Admin', operator: 'contains' },
      { field: 'description', value: 'Administrator', operator: 'contains' }
    ];
    
    render(<RoleFilters filters={twoFilters} onFiltersChange={onFiltersChangeMock} />);
    
    // Find the clear filters button
    const clearButton = screen.getByRole('button', { name: /clear all filters/i });
    await user.click(clearButton);
    
    // The onFiltersChange should have been called with empty array
    expect(onFiltersChangeMock).toHaveBeenCalledWith([]);
  });
  
  test('loads and displays permission options for permission filter', async () => {
    const user = userEvent.setup();
    render(<RoleFilters filters={[]} onFiltersChange={onFiltersChangeMock} />);
    
    // Change filter type to permission
    const fieldSelect = screen.getByLabelText('Field');
    await user.click(fieldSelect);
    const permissionOption = screen.getByRole('option', { name: 'Permission' });
    await user.click(permissionOption);
    
    // Open the permission dropdown
    const permissionInput = screen.getByLabelText('Select Permissions');
    await user.click(permissionInput);
    
    // Wait for permissions to load
    await waitFor(() => {
      expect(roleApi.getAllPermissionNames).toHaveBeenCalled();
    });
    
    // Check permissions are displayed
    for (const permission of mockPermissions) {
      expect(screen.getByText(permission)).toBeInTheDocument();
    }
    
    // Select a permission
    const permOption = screen.getByText('CREATE_USER');
    await user.click(permOption);
    
    // The onFiltersChange should have been called with permission filter
    expect(onFiltersChangeMock).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ 
        field: 'permission', 
        value: expect.arrayContaining(['CREATE_USER']) 
      })
    ]));
  });
}); 