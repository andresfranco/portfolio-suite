import { lazy } from 'react';

// Lazy load components for code splitting
const SkillTypeIndex = lazy(() => import('./SkillTypeIndex'));
const SkillTypeForm = lazy(() => import('./SkillTypeForm'));
const SkillTypeFilters = lazy(() => import('./SkillTypeFilters'));
const SkillTypeErrorBoundary = lazy(() => import('./SkillTypeErrorBoundary'));

// Export lazy components
export { SkillTypeIndex, SkillTypeForm, SkillTypeFilters, SkillTypeErrorBoundary };

// Default export for main index component
export default SkillTypeIndex; 