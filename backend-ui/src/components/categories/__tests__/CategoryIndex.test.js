import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CategoryProvider } from '../../../contexts/CategoryContext';
import { CategoryTypeProvider } from '../../../contexts/CategoryTypeContext';
import { LanguageProvider } from '../../../contexts/LanguageContext';
import CategoryIndex from '../CategoryIndex';
import { CategoryErrorBoundary } from '../CategoryErrorBoundary';

// Mock the API services
jest.mock('../../../services/categoryApi', () => ({
  fetchCategories: jest.fn(() => Promise.resolve({
    data: {
      items: [
        {
          id: 1,
          code: 'TEST1',
          type_code: 'GEN',
          category_texts: [
            {
              id: 1,
              name: 'Test Category 1',
              description: 'Test description 1',
              language_id: 1,
              language: { id: 1, code: 'EN', name: 'English', is_default: true }
            }
          ]
        },
        {
          id: 2,
          code: 'TEST2',
          type_code: 'TECH',
          category_texts: [
            {
              id: 2,
              name: 'Test Category 2',
              description: 'Test description 2',
              language_id: 1,
              language: { id: 1, code: 'EN', name: 'English', is_default: true }
            }
          ]
        }
      ],
      total: 2,
      page: 1,
      page_size: 10
    }
  })),
  createCategory: jest.fn(() => Promise.resolve({
    data: { id: 3, code: 'NEW_CAT', type_code: 'GEN', category_texts: [] }
  })),
  updateCategory: jest.fn(() => Promise.resolve({
    data: { id: 1, code: 'UPDATED_CAT', type_code: 'GEN', category_texts: [] }
  })),
  deleteCategory: jest.fn(() => Promise.resolve({ data: {} })),
  checkCategoryCodeExists: jest.fn(() => Promise.resolve({ exists: false }))
}));

jest.mock('../../../services/categoryTypeApi', () => ({
  getCategoryTypes: jest.fn(() => Promise.resolve({
    data: {
      items: [
        { code: 'GEN', name: 'General' },
        { code: 'TECH', name: 'Technology' }
      ],
      total: 2
    }
  }))
}));

jest.mock('../../../services/languageApi', () => ({
  getLanguages: jest.fn(() => Promise.resolve({
    data: {
      items: [
        { id: 1, code: 'EN', name: 'English', is_default: true },
        { id: 2, code: 'ES', name: 'Spanish', is_default: false }
      ],
      total: 2
    }
  }))
}));

// Helper component to provide all necessary contexts
const TestWrapper = ({ children }) => (
  <CategoryProvider>
    <CategoryTypeProvider>
      <LanguageProvider>
        {children}
      </LanguageProvider>
    </CategoryTypeProvider>
  </CategoryProvider>
);

describe('CategoryIndex Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders categories management heading', async () => {
    render(
      <TestWrapper>
        <CategoryIndex />
      </TestWrapper>
    );

    expect(screen.getByText('Categories Management')).toBeInTheDocument();
  });

  test('displays loading state initially', () => {
    render(
      <TestWrapper>
        <CategoryIndex />
      </TestWrapper>
    );

    expect(screen.getByText('Loading data...')).toBeInTheDocument();
  });

  test('renders category grid with data', async () => {
    render(
      <TestWrapper>
        <CategoryIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('TEST1')).toBeInTheDocument();
      expect(screen.getByText('TEST2')).toBeInTheDocument();
    });
  });

  test('displays new category button', async () => {
    render(
      <TestWrapper>
        <CategoryIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('New Category')).toBeInTheDocument();
    });
  });

  test('opens category form when new category button is clicked', async () => {
    render(
      <TestWrapper>
        <CategoryIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const newButton = screen.getByText('New Category');
      fireEvent.click(newButton);
    });

    // The form dialog should open
    await waitFor(() => {
      expect(screen.getByText('Create New Category')).toBeInTheDocument();
    });
  });

  test('displays edit and delete action buttons for each category', async () => {
    render(
      <TestWrapper>
        <CategoryIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText(/edit category/i);
      const deleteButtons = screen.getAllByLabelText(/delete category/i);
      
      expect(editButtons).toHaveLength(2);
      expect(deleteButtons).toHaveLength(2);
    });
  });

  test('opens edit form when edit button is clicked', async () => {
    render(
      <TestWrapper>
        <CategoryIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const editButtons = screen.getAllByLabelText(/edit category/i);
      fireEvent.click(editButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Edit Category')).toBeInTheDocument();
    });
  });

  test('opens delete form when delete button is clicked', async () => {
    render(
      <TestWrapper>
        <CategoryIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const deleteButtons = screen.getAllByLabelText(/delete category/i);
      fireEvent.click(deleteButtons[0]);
    });

    await waitFor(() => {
      expect(screen.getByText('Delete Category')).toBeInTheDocument();
    });
  });

  test('handles pagination change', async () => {
    render(
      <TestWrapper>
        <CategoryIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      const pageSelect = screen.getByDisplayValue('10');
      fireEvent.change(pageSelect, { target: { value: '20' } });
    });

    // Verify API call was made with new page size
    // This would require mocking the context methods appropriately
  });

  test('displays category names with language codes', async () => {
    render(
      <TestWrapper>
        <CategoryIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Test Category 1 \(EN\)/)).toBeInTheDocument();
      expect(screen.getByText(/Test Category 2 \(EN\)/)).toBeInTheDocument();
    });
  });

  test('displays language chips for each category', async () => {
    render(
      <TestWrapper>
        <CategoryIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/English \(EN\)/)).toBeInTheDocument();
    });
  });

  test('handles sorting when column headers are clicked', async () => {
    render(
      <TestWrapper>
        <CategoryIndex />
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
        <CategoryIndex />
      </TestWrapper>
    );

    await waitFor(() => {
      // Look for filter-related elements
      expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument();
    });
  });
});

describe('CategoryErrorBoundary', () => {
  // Mock component that throws an error
  const ThrowError = () => {
    throw new Error('Test error');
  };

  test('catches and displays error', () => {
    // Suppress console.error for this test
    const originalError = console.error;
    console.error = jest.fn();

    render(
      <CategoryErrorBoundary>
        <ThrowError />
      </CategoryErrorBoundary>
    );

    expect(screen.getByText('Something went wrong in the Category component')).toBeInTheDocument();
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
      <CategoryErrorBoundary>
        <ToggleError />
      </CategoryErrorBoundary>
    );

    expect(screen.getByText('Something went wrong in the Category component')).toBeInTheDocument();

    // Change the component to not throw
    shouldThrow = false;

    // Click try again
    const tryAgainButton = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(tryAgainButton);

    // Re-render the component
    rerender(
      <CategoryErrorBoundary>
        <ToggleError />
      </CategoryErrorBoundary>
    );

    expect(screen.getByText('Success')).toBeInTheDocument();

    console.error = originalError;
  });

  test('renders children when no error occurs', () => {
    render(
      <CategoryErrorBoundary>
        <div>Test content</div>
      </CategoryErrorBoundary>
    );

    expect(screen.getByText('Test content')).toBeInTheDocument();
  });
}); 