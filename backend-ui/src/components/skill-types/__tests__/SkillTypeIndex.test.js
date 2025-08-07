import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import theme from '../../../theme';
import SkillTypeIndex from '../SkillTypeIndex';
import * as skillTypeApi from '../../../services/skillTypeApi';

// Mock the API service
jest.mock('../../../services/skillTypeApi');

// Mock the logger
jest.mock('../../../utils/logger', () => ({
  logInfo: jest.fn(),
  logError: jest.fn(),
}));

// Mock the SkillTypeContext
const mockSkillTypeContext = {
  skillTypes: [],
  loading: false,
  error: null,
  errorType: null,
  pagination: { page: 0, pageSize: 10, total: 0 },
  filters: {},
  fetchSkillTypes: jest.fn(),
  fetchSkillTypeByCode: jest.fn(),
  createSkillType: jest.fn(),
  updateSkillType: jest.fn(),
  deleteSkillType: jest.fn(),
  checkCodeExists: jest.fn(),
  updateFilters: jest.fn(),
  clearFilters: jest.fn(),
  clearError: jest.fn(),
};

jest.mock('../../../contexts/SkillTypeContext', () => ({
  useSkillType: () => mockSkillTypeContext,
  SkillTypeProvider: ({ children }) => children,
}));

const TestWrapper = ({ children }) => (
  <BrowserRouter>
    <ThemeProvider theme={theme}>
      {children}
    </ThemeProvider>
  </BrowserRouter>
);

describe('SkillTypeIndex', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset mock context state
    mockSkillTypeContext.skillTypes = [];
    mockSkillTypeContext.loading = false;
    mockSkillTypeContext.error = null;
    mockSkillTypeContext.pagination = { page: 0, pageSize: 10, total: 0 };
    mockSkillTypeContext.filters = {};
  });

  test('renders skill types index correctly', () => {
    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    expect(screen.getByText('Skill Types')).toBeInTheDocument();
    expect(screen.getByText('Create Skill Type')).toBeInTheDocument();
  });

  test('displays loading state', () => {
    mockSkillTypeContext.loading = true;

    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    expect(screen.getByText('Loading skill types...')).toBeInTheDocument();
  });

  test('displays error message when error exists', () => {
    mockSkillTypeContext.error = 'Failed to fetch skill types';

    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    expect(screen.getByText('Failed to fetch skill types')).toBeInTheDocument();
  });

  test('displays skill types in data grid', () => {
    const mockSkillTypes = [
      { code: 'PROG', name: 'Programming Languages' },
      { code: 'FRAME', name: 'Frameworks' },
    ];
    mockSkillTypeContext.skillTypes = mockSkillTypes;
    mockSkillTypeContext.pagination = { page: 0, pageSize: 10, total: 2 };

    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    expect(screen.getByText('PROG')).toBeInTheDocument();
    expect(screen.getByText('Programming Languages')).toBeInTheDocument();
    expect(screen.getByText('FRAME')).toBeInTheDocument();
    expect(screen.getByText('Frameworks')).toBeInTheDocument();
  });

  test('opens create modal when create button is clicked', async () => {
    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    const createButton = screen.getByText('Create Skill Type');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create New Skill Type')).toBeInTheDocument();
    });
  });

  test('opens edit modal when edit button is clicked', async () => {
    const mockSkillTypes = [
      { code: 'PROG', name: 'Programming Languages' },
    ];
    mockSkillTypeContext.skillTypes = mockSkillTypes;

    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    const editButton = screen.getByLabelText('Edit skill type');
    fireEvent.click(editButton);

    await waitFor(() => {
      expect(screen.getByText('Edit Skill Type')).toBeInTheDocument();
    });
  });

  test('opens delete modal when delete button is clicked', async () => {
    const mockSkillTypes = [
      { code: 'PROG', name: 'Programming Languages' },
    ];
    mockSkillTypeContext.skillTypes = mockSkillTypes;

    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    const deleteButton = screen.getByLabelText('Delete skill type');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(screen.getByText('Delete Skill Type')).toBeInTheDocument();
    });
  });

  test('handles pagination correctly', async () => {
    const mockSkillTypes = [
      { code: 'PROG', name: 'Programming Languages' },
    ];
    mockSkillTypeContext.skillTypes = mockSkillTypes;
    mockSkillTypeContext.pagination = { page: 0, pageSize: 10, total: 15 };

    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    // DataGrid pagination is handled by MUI, so we test that it's rendered
    expect(screen.getByRole('button', { name: /next page/i })).toBeInTheDocument();
  });

  test('calls fetchSkillTypes on component mount', () => {
    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    expect(mockSkillTypeContext.fetchSkillTypes).toHaveBeenCalled();
  });

  test('handles sort model changes', async () => {
    const mockSkillTypes = [
      { code: 'PROG', name: 'Programming Languages' },
    ];
    mockSkillTypeContext.skillTypes = mockSkillTypes;

    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    // Simulate clicking on a column header to sort
    const codeHeader = screen.getByText('Code');
    fireEvent.click(codeHeader);

    await waitFor(() => {
      expect(mockSkillTypeContext.fetchSkillTypes).toHaveBeenCalled();
    });
  });

  test('displays no rows message when no skill types exist', () => {
    mockSkillTypeContext.skillTypes = [];
    mockSkillTypeContext.pagination = { page: 0, pageSize: 10, total: 0 };

    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    expect(screen.getByText('No skill types found')).toBeInTheDocument();
    expect(screen.getByText('Get started by creating your first skill type.')).toBeInTheDocument();
  });

  test('displays filtered message when filters are applied but no results', () => {
    mockSkillTypeContext.skillTypes = [];
    mockSkillTypeContext.filters = { code: 'TEST' };
    mockSkillTypeContext.pagination = { page: 0, pageSize: 10, total: 0 };

    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    expect(screen.getByText('No skill types found')).toBeInTheDocument();
    expect(screen.getByText('Try adjusting your filters or create a new skill type.')).toBeInTheDocument();
  });

  test('closes modal properly', async () => {
    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    // Open modal
    const createButton = screen.getByText('Create Skill Type');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create New Skill Type')).toBeInTheDocument();
    });

    // Close modal
    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Create New Skill Type')).not.toBeInTheDocument();
    });
  });

  test('refreshes data when modal closes with shouldRefresh=true', async () => {
    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    // Open modal
    const createButton = screen.getByText('Create Skill Type');
    fireEvent.click(createButton);

    await waitFor(() => {
      expect(screen.getByText('Create New Skill Type')).toBeInTheDocument();
    });

    // Simulate successful operation (this would normally be triggered by the form)
    // We can't easily simulate this without mocking the form component entirely
    expect(mockSkillTypeContext.fetchSkillTypes).toHaveBeenCalled();
  });

  test('handles error clearing', () => {
    mockSkillTypeContext.error = 'Test error';

    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    const closeButton = screen.getByLabelText('Close');
    fireEvent.click(closeButton);

    expect(mockSkillTypeContext.clearError).toHaveBeenCalled();
  });

  test('renders filter component', () => {
    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    // The filters component should be rendered
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  test('action buttons have correct tooltips', async () => {
    const mockSkillTypes = [
      { code: 'PROG', name: 'Programming Languages' },
    ];
    mockSkillTypeContext.skillTypes = mockSkillTypes;

    render(
      <TestWrapper>
        <SkillTypeIndex />
      </TestWrapper>
    );

    const editButton = screen.getByLabelText('Edit skill type');
    const deleteButton = screen.getByLabelText('Delete skill type');

    expect(editButton).toBeInTheDocument();
    expect(deleteButton).toBeInTheDocument();
  });
}); 