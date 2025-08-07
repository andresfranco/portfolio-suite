import React from 'react';

// Lazy load components for code splitting
export const CategoryIndex = React.lazy(() => import('./CategoryIndex'));
export const CategoryForm = React.lazy(() => import('./CategoryForm'));
export const CategoryFilters = React.lazy(() => import('./CategoryFilters'));
export { default as CategoryErrorBoundary } from './CategoryErrorBoundary';

// For backward compatibility, also export as default
export default CategoryIndex; 