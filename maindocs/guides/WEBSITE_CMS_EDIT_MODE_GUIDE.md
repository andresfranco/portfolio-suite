# Website CMS Edit Mode Guide

This guide documents the edit-mode CMS capabilities currently implemented in the `website/`, `backend-ui/`, and `portfolio-backend/` applications.

## Scope

Implemented capabilities covered here:
- Enable website edit mode from the admin UI
- Edit section labels and inline text content
- Edit project metadata and descriptions
- Upload/select project images (thumbnail/logo)
- Work with language-specific editable content

## Architecture (Implemented)

- **Admin UI token bridge**: `backend-ui` requests `GET /api/auth/generate-website-token`
- **Website edit session**: `website/src/context/EditModeContext.js`
- **Inline editing**: `website/src/components/cms/InlineTextEditor.js`
- **Editable labels hook**: `website/src/hooks/useSectionLabel.js`
- **Project image management**: `website/src/components/cms/ProjectImageSelector.js`
- **CMS backend endpoints**: `portfolio-backend/app/api/endpoints/cms.py`

## Prerequisites

1. Backend API is running.
2. Admin UI is running.
3. Website app is running.
4. Your user has content-edit permissions.

## Editing Workflow

1. Sign in to the Admin UI.
2. Open the website in edit mode from Admin UI (uses `generate-website-token`).
3. Confirm the website edit toolbar/indicator is visible.
4. Click editable text/labels to modify content.
5. Save changes (inline save/blur behavior depends on editor component).
6. Refresh or switch language to validate localized content updates.

## What You Can Edit

### 1. Section Labels

Examples in current implementation include:
- Navigation labels
- Projects section labels and button text
- Contact form labels
- Footer text

Reference implementation:
- `website/src/hooks/useSectionLabel.js`
- `website/src/components/Header.js`
- `website/src/components/Projects.js`
- `website/src/components/Contact.js`
- `website/src/components/Footer.js`

### 2. Project Content

Supported in current implementation:
- Project names
- Project descriptions
- Project detail labels/fields where editable wrappers are applied

Reference implementation:
- `website/src/components/Projects.js`
- `website/src/components/ProjectDetails.js`

### 3. Project Images

Supported image operations:
- Select existing image by category and language
- Upload new image (edit mode)
- Manage thumbnail/logo usage from project UI

Reference implementation:
- `website/src/components/cms/ProjectImageSelector.js`
- `website/src/components/DraggableProjectCard.js`
- `website/src/components/ProjectDetails.js`

## Language-Specific Content

The CMS supports language-specific content updates where language-aware entities are used.
Validate changes by switching languages in the website and confirming the expected localized value appears.

## Troubleshooting

### Edit mode not available
- Confirm user permissions in Admin UI.
- Verify `GET /api/auth/generate-website-token` succeeds.
- Check backend logs for auth/permission failures.

### Changes not saved
- Verify backend API connectivity from website (`REACT_APP_API_URL`).
- Confirm auth token is valid and not expired.
- Inspect browser network calls for CMS API errors.

### Image upload issues
- Verify accepted file type/size constraints in UI.
- Confirm backend upload endpoint is reachable.
- Check server-side file validation and scan settings.

## Related Docs

- `maindocs/guides/VPS_DEPLOYMENT_GUIDE.md`
- `maindocs/security/SECURITY.md`
- `portfolio-backend/README.md`
- `backend-ui/README.md`
- `website/README.md`
