import React from 'react';

// Lazy load components for code splitting
export const CategoryTypeIndex = React.lazy(() => import('./CategoryTypeIndex'));
export const CategoryTypeForm = React.lazy(() => import('./CategoryTypeForm'));
export const CategoryTypeFilters = React.lazy(() => import('./CategoryTypeFilters'));
export { default as CategoryTypeErrorBoundary } from './CategoryTypeErrorBoundary';

// For backward compatibility, also export as default
export default CategoryTypeIndex; 