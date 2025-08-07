import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import PermissionIndex from '../PermissionIndex';
import { usePermission } from '../../../contexts/PermissionContext';

// Mock the entire PermissionContext module
jest.mock('../../../contexts/PermissionContext', () => {
  return {
    usePermission: jest.fn(),
    PermissionProvider: ({ children }) => <div data-testid="mock-provider">{children}</div>,
  };
});

// Mock the ReusableDataGrid component
jest.mock('../../../components/common/ReusableDataGrid', () => {
  return function MockDataGrid(props) {
    return (
      <div data-testid="mock-data-grid">
        {props.loading && <div data-testid="loading-indicator">Loading...</div>}
        
        {props.error && (
          <div role="alert" data-testid="error-alert">
            {props.error}
            <button 
              onClick={() => props.onRetry && props.onRetry()} 
              data-testid="retry-button"
            >
              Retry
            </button>
          </div>
        )}
        
        {!props.loading && !props.error && (
          <>
            <button 
              onClick={() => props.onCreateClick && props.onCreateClick()}
              data-testid="add-new-button"
            >
              Add New
            </button>
            {props.rows && props.rows.map(row => (
              <div key={row.id} data-testid={`row-${row.id}`}>
                {row.name}
                <button 
                  data-testid={`edit-${row.id}`} 
                  onClick={() => props.onEditClick && props.onEditClick(row)}
                >
                  Edit
                </button>
                <button 
                  data-testid={`delete-${row.id}`} 
                  onClick={() => props.onDeleteClick && props.onDeleteClick(row)}
                >
                  Delete
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    );
  };
});

// Mock the PermissionForm component
jest.mock('../PermissionForm', () => {
  return function MockPermissionForm(props) {
    return props.open ? (
      <div data-testid="mock-permission-form" data-mode={props.mode}>
        <button data-testid="cancel-button" onClick={() => props.onClose(false)}>Cancel</button>
        <button data-testid="save-button" onClick={() => props.onClose(true)}>Save</button>
      </div>
    ) : null;
  };
});

// Mock the logger to avoid console noise
jest.mock('../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

describe('PermissionIndex', () => {
  // Mock permission data for testing
  const mockPermissions = [
    {
      id: 1,
      name: 'CREATE_USER',
      description: 'Allow creating users',
      roles_count: 2
    },
    {
      id: 2,
      name: 'VIEW_DASHBOARD',
      description: 'Allow viewing the dashboard',
      roles_count: 1
    }
  ];

  // Default context values
  const mockContextValue = {
    permissions: mockPermissions,
    loading: false,
    error: null,
    pagination: {
      page: 1,
      page_size: 10,
      total: 2
    },
    filters: {},
    fetchPermissions: jest.fn(),
    updateFilters: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    usePermission.mockReturnValue(mockContextValue);
  });

  test('renders with PermissionProvider', () => {
    render(<PermissionIndex />);
    expect(screen.getByTestId('mock-provider')).toBeInTheDocument();
  });

  test('renders data grid with permissions', () => {
    render(<PermissionIndex />);
    expect(screen.getByTestId('mock-data-grid')).toBeInTheDocument();
    mockPermissions.forEach(permission => {
      expect(screen.getByText(permission.name)).toBeInTheDocument();
    });
  });

  test('renders add new button for permissions', () => {
    render(<PermissionIndex />);
    expect(screen.getByTestId('add-new-button')).toBeInTheDocument();
  });

  test('renders edit buttons for each permission', () => {
    render(<PermissionIndex />);
    mockPermissions.forEach(permission => {
      expect(screen.getByTestId(`edit-${permission.id}`)).toBeInTheDocument();
    });
  });

  test('renders delete buttons for each permission', () => {
    render(<PermissionIndex />);
    mockPermissions.forEach(permission => {
      expect(screen.getByTestId(`delete-${permission.id}`)).toBeInTheDocument();
    });
  });

  test('renders loading indicator when loading is true', () => {
    usePermission.mockReturnValue({
      ...mockContextValue,
      loading: true
    });
    render(<PermissionIndex />);
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
  });
});
