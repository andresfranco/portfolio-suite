# Plan for Reusable Data Grid and Filters

This document outlines an approach to consolidate the existing grid implementations into a single reusable component. The goal is to maintain the same sorting, pagination strategy, look and feel and styles currently provided by the **CategoryTypeIndex** data grid.

## Overview

Many modules (categories, category types, skills, languages, permissions, roles and more) implement their own MUI **DataGrid** with almost identical pagination logic and styling. Reusable logic already exists in `src/components/common/ReusableDataGrid.js`, but several modules still duplicate grid code or use variations of the original **CategoryTypeIndex** component. A shared solution simplifies maintenance and keeps the user experience consistent.

## Proposed Approach

1. **Centralize Grid Logic**
   - Ensure `ReusableDataGrid` exposes props for server side sorting, filtering and pagination.
   - Extract the styling rules from `CategoryTypeIndex` and apply them as defaults in the reusable component.
   - Provide optional overrides for specific modules (columns, visibility model, custom actions).

2. **Generic Filter Component**
   - Create a small `ReusableFilters` component that accepts filter configuration (field, type, label, operator) and works in tandem with `ReusableDataGrid`.
   - Filters from `CategoryTypeFilters` serve as the reference implementation for the UI layout and form behaviour.
   - `ReusableDataGrid` will accept a `FiltersComponent` prop so each module can plug in its own filter UI if additional fields are required.

3. **Consistent Pagination Strategy**
   - Reuse the custom pagination component implemented in `CategoryTypeIndex` for all grids. This component allows selecting page size and navigating pages while keeping the design consistent.
   - `ReusableDataGrid` already handles pagination and sort model changes. Ensure this behaviour matches the CategoryTypeIndex strategy: server-mode pagination with page index starting at 0 and `page_size` and `page` parameters.

4. **Styling and Theming**
   - Copy the look and feel from `CategoryTypeIndex` by applying its CSS rules (row height, header background, hover colours, hidden sort icons etc.) as the default style in `ReusableDataGrid`.
   - Define styles in one place to avoid inline repetition and guarantee uniform appearance across modules.

5. **Module Integration Steps**
   - Replace each existing grid component (e.g. `CategoryIndex`, `SkillTypeIndex`, `UserIndex`, etc.) with `ReusableDataGrid`.
   - Implement module‑specific filter components if needed and pass them to the grid via the `FiltersComponent` prop.
   - Remove local pagination or sorting handlers in favour of the shared handlers.

## Impacted Modules

The following folders currently define their own grids or pagination logic and would benefit from migration to the reusable solution:

- `src/components/categories`
- `src/components/categorytypes`
- `src/components/experiences`
- `src/components/languages`
- `src/components/permissions`
- `src/components/portfolios`
- `src/components/projects`
- `src/components/roles`
- `src/components/sections`
- `src/components/skill-types`
- `src/components/skills`
- `src/components/translations`
- `src/components/users`
- Any future modules that require a tabular display

Updating these modules will reduce code duplication and enforce a single style across the admin panel.

## Benefits

- **Consistency**: All grids share the same look and behaviour.
- **Maintainability**: Fixes or improvements in the reusable component propagate automatically.
- **Smaller Components**: Index pages only define their columns and custom actions.
- **Easier Onboarding**: Developers only need to learn one grid API.

## Next Steps

1. Review the existing `ReusableDataGrid` and `CategoryTypeFilters` implementations to identify any missing features.
2. Refactor duplicated grid logic in the modules listed above to use the reusable components.
3. Update the documentation and examples to reference the new pattern.
4. Ensure unit tests cover the grid behaviour in a module‑agnostic way.

