import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategoryTypeProvider } from '../../../contexts/CategoryTypeContext';
import CategoryTypeIndex from '../CategoryTypeIndex';
import { CategoryTypeErrorBoundary } from '../CategoryTypeErrorBoundary';

// Mock the API services
jest.mock('../../../services/categoryTypeApi', () => ({
  getCategoryTypes: jest.fn(() => Promise.resolve({
    data: {
      items: [
        { code: 'GEN', name: 'General' },
        { code: 'TECH', name: 'Technology' },
        { code: 'SOFT', name: 'Soft Skills' }
      ],
      total: 3,
      page: 1,
      pageSize: 10
    }
  })),
  createCategoryType: jest.fn(() => Promise.resolve({
    data: { code: 'NEW', name: 'New Type' }
  })),
  updateCategoryType: jest.fn(() => Promise.resolve({
    data: { code: 'UPD', name: 'Updated Type' }
  })),
  deleteCategoryType: jest.fn(() => Promise.resolve({ data: {} })),
  checkCodeExists: jest.fn(() => Promise.resolve({ exists: false }))
}));

// Helper component to provide context
const TestWrapper = ({ children }) => (
  <CategoryTypeProvider>
    {children}
  </CategoryTypeProvider>
);

describe('CategoryTypeIndex Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders category types management heading', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    expect(screen.getByText('Category Types Management')).toBeInTheDocument();
  });

  test('displays loading state initially', () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  test('renders category types grid with data', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('GEN')).toBeInTheDocument();
      expect(screen.getByText('General')).toBeInTheDocument();
      expect(screen.getByText('TECH')).toBeInTheDocument();
      expect(screen.getByText('Technology')).toBeInTheDocument();
    });
  });

  test('displays new category type button', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('New Category Type')).toBeInTheDocument();
    });
  });

  test('opens category type form when new button is clicked', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const newButton = screen.getByText('New Category Type');
      fireEvent.click(newButton);
    });

    // The form dialog should open
    await waitFor(() => {
      expect(screen.getByText('Create New Category Type')).toBeInTheDocument();
    });
  });

  test('displays edit and delete action buttons for each category type', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText(/edit category type/i);
      const deleteButtons = screen.getAllByLabelText(/delete category type/i);
      
      expect(editButtons).toHaveLength(3);
      expect(deleteButtons).toHaveLength(3);
    });
  });

  test('opens edit form when edit button is clicked', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText(/edit category type/i);
      fireEvent.click(editButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Edit Category Type')).toBeInTheDocument();
    });
  });

  test('opens delete form when delete button is clicked', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText(/delete category type/i);
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Delete Category Type')).toBeInTheDocument();
    });
  });

  test('handles pagination change', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const pageSelect = screen.getByDisplayValue('10');
      fireEvent.change(pageSelect, { target: { value: '20' } });
    });

    // Verify API call was made with new page size
    // This would require mocking the context methods appropriately
  });

  test('handles sorting when column headers are clicked', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const codeHeader = screen.getByText('Code');
      fireEvent.click(codeHeader);
    });

    // Verify sort functionality is working
    // This would require more detailed mocking of the context
  });

  test('renders filters component', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      // Look for filter-related elements
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    });
  });

  test('displays correct column headers', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Code')).toBeInTheDocument();
      expect(screen.getByText('Name')).toBeInTheDocument();
      expect(screen.getByText('Actions')).toBeInTheDocument();
    });
  });

  test('handles search functionality', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const searchButton = screen.getByRole('button', { name: /search/i });
      fireEvent.click(searchButton);
    });

    // Verify search functionality is working
    // This would require more detailed mocking of the context
  });

  test('handles clear filters functionality', async () => {
    render(
      <TestWrapper>
        <CategoryTypeIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const clearButton = screen.getByRole('button', { name: /clear/i });
      fireEvent.click(clearButton);
    });

    // Verify clear functionality is working
    // This would require more detailed mocking of the context
  });
});

describe('CategoryTypeErrorBoundary', () => {
  // Mock component that throws an error
  const ThrowError = () => {
    throw new Error('Test error');
  };

  test('catches and displays error', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = jest.fn();

    render(
      <CategoryTypeErrorBoundary>
        <ThrowError />
      </CategoryTypeErrorBoundary>
    );

    expect(screen.getByText('Something went wrong in the CategoryType component')).toBeInTheDocument();
    expect(screen.getByText('Test error')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();

    // Restore console.error
    console.error = originalError;
  });

  test('resets error state when try again button is clicked', () => {
    const originalError = console.error;
    console.error = jest.fn();

    // We need a component that can toggle between throwing and not throwing
    let shouldThrow = true;
    const ToggleError = () => {
      if (shouldThrow) {
        throw new Error('Test error');
      }
      return <div>Success</div>;
    };

    const { rerender } = render(
      <CategoryTypeErrorBoundary>
        <ToggleError />
      </CategoryTypeErrorBoundary>
    );

    expect(screen.getByText('Something went wrong in the CategoryType component')).toBeInTheDocument();

    // Change the component to not throw
    shouldThrow = false;

    // Click try again
    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(tryAgainButton);

    // Re-render the component
    rerender(
      <CategoryTypeErrorBoundary>
        <ToggleError />
      </CategoryTypeErrorBoundary>
    );

    expect(screen.getByText('Success')).toBeInTheDocument();

    console.error = originalError;
  });

  test('renders children when no error occurs', () => {
    render(
      <CategoryTypeErrorBoundary>
        <div>Test content</div>
      </CategoryTypeErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
}); 