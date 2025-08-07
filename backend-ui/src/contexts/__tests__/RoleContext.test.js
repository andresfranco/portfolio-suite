import { renderHook, act } from '@testing-library/react';
import { RoleProvider, useRole } from '../RoleContext';
import roleApi from '../../services/roleApi';

// Mock the roleApi module
jest.mock('../../services/roleApi', () => ({
  getRoles: jest.fn(),
  createRole: jest.fn(),
  updateRole: jest.fn(),
  deleteRole: jest.fn(),
  getAllPermissionNames: jest.fn()
}));

// Mock logger
jest.mock('../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn()
}));

describe('RoleContext', () => {
  const mockRolesResponse = {
    data: {
      items: [
        { 
          id: 1, 
          name: 'Admin', 
          description: 'Administrator', 
          permissions: ['CREATE_USER', 'DELETE_USER'],
          users_count: 2 
        },
        { 
          id: 2, 
          name: 'User', 
          description: 'Regular user', 
          permissions: ['VIEW_DASHBOARD'],
          users_count: 10 
        }
      ],
      page: 1,
      page_size: 10,
      total: 2
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mocked response
    roleApi.getRoles.mockResolvedValue(mockRolesResponse);
  });

  const wrapper = ({ children }) => <RoleProvider>{children}</RoleProvider>;

  test('provides initial state values', () => {
    const { result } = renderHook(() => useRole(), { wrapper });
    
    expect(result.current.roles).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.pagination).toEqual({
      page: 1,
      page_size: 10,
      total: 0
    });
    expect(result.current.filters).toEqual([]);
  });

  test('fetches roles with pagination and updates state', async () => {
    const { result } = renderHook(() => useRole(), { wrapper });
    
    await act(async () => {
      await result.current.fetchRoles(1, 10);
    });
    
    expect(roleApi.getRoles).toHaveBeenCalledWith({
      page: 1,
      page_size: 10
    });
    
    expect(result.current.roles).toEqual(mockRolesResponse.data.items);
    expect(result.current.pagination).toEqual({
      page: 1,
      page_size: 10,
      total: 2
    });
    expect(result.current.loading).toBe(false);
  });

  test('handles filter objects correctly when fetching roles', async () => {
    const { result } = renderHook(() => useRole(), { wrapper });
    
    const filters = [
      { field: 'name', value: 'Admin', operator: 'contains' },
      { field: 'permission', value: 'CREATE_USER', operator: 'eq' }
    ];
    
    await act(async () => {
      await result.current.fetchRoles(1, 10, filters);
    });
    
    expect(roleApi.getRoles).toHaveBeenCalledWith({
      page: 1,
      page_size: 10,
      filters: filters
    });
  });

  test('adds a filter correctly', async () => {
    const { result } = renderHook(() => useRole(), { wrapper });
    
    const filter = { field: 'name', value: 'Admin', operator: 'contains' };
    
    await act(async () => {
      result.current.addFilter(filter);
    });
    
    expect(result.current.filters).toContainEqual(filter);
  });

  test('removes a filter correctly', async () => {
    const { result } = renderHook(() => useRole(), { wrapper });
    
    const filter1 = { field: 'name', value: 'Admin', operator: 'contains' };
    const filter2 = { field: 'description', value: 'test', operator: 'contains' };
    
    await act(async () => {
      result.current.addFilter(filter1);
      result.current.addFilter(filter2);
    });
    
    expect(result.current.filters).toHaveLength(2);
    
    await act(async () => {
      result.current.removeFilter('name');
    });
    
    expect(result.current.filters).toHaveLength(1);
    expect(result.current.filters[0]).toEqual(filter2);
  });

  test('clears all filters correctly', async () => {
    const { result } = renderHook(() => useRole(), { wrapper });
    
    const filter1 = { field: 'name', value: 'Admin', operator: 'contains' };
    const filter2 = { field: 'description', value: 'test', operator: 'contains' };
    
    await act(async () => {
      result.current.addFilter(filter1);
      result.current.addFilter(filter2);
    });
    
    expect(result.current.filters).toHaveLength(2);
    
    await act(async () => {
      result.current.clearFilters();
    });
    
    expect(result.current.filters).toHaveLength(0);
  });

  test('updates filters array correctly', async () => {
    const { result } = renderHook(() => useRole(), { wrapper });
    
    const newFilters = [
      { field: 'name', value: 'Manager', operator: 'contains' },
      { field: 'permission', value: 'EDIT_USER', operator: 'eq' }
    ];
    
    await act(async () => {
      result.current.updateFilters(newFilters);
    });
    
    expect(result.current.filters).toEqual(newFilters);
    expect(roleApi.getRoles).toHaveBeenCalled();
  });

  test('creates a role and refreshes the list', async () => {
    const newRole = {
      name: 'New Role',
      description: 'New role description',
      permissions: ['VIEW_DASHBOARD']
    };
    
    roleApi.createRole.mockResolvedValue({
      data: { ...newRole, id: 3 }
    });
    
    const { result } = renderHook(() => useRole(), { wrapper });
    
    await act(async () => {
      await result.current.createRole(newRole);
    });
    
    expect(roleApi.createRole).toHaveBeenCalledWith(newRole);
    expect(roleApi.getRoles).toHaveBeenCalled();
  });

  test('updates a role and refreshes the list', async () => {
    const updatedRole = {
      name: 'Updated Role',
      description: 'Updated description',
      permissions: ['VIEW_DASHBOARD', 'CREATE_USER']
    };
    
    roleApi.updateRole.mockResolvedValue({
      data: { ...updatedRole, id: 1 }
    });
    
    const { result } = renderHook(() => useRole(), { wrapper });
    
    await act(async () => {
      await result.current.updateRole(1, updatedRole);
    });
    
    expect(roleApi.updateRole).toHaveBeenCalledWith(1, updatedRole);
    expect(roleApi.getRoles).toHaveBeenCalled();
  });

  test('deletes a role and refreshes the list', async () => {
    roleApi.deleteRole.mockResolvedValue({});
    
    const { result } = renderHook(() => useRole(), { wrapper });
    
    // Set initial state with roles
    await act(async () => {
      await result.current.fetchRoles(1, 10);
    });
    
    await act(async () => {
      await result.current.deleteRole(1);
    });
    
    expect(roleApi.deleteRole).toHaveBeenCalledWith(1);
    expect(roleApi.getRoles).toHaveBeenCalled();
  });
}); 