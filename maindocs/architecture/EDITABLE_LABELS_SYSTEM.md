# Editable Labels System

## Overview

This system makes ALL labels in the website editable through the CMS edit mode, including navigation links, button labels, form labels, and page headings. Labels are stored in the database as "sections" with translations per language.

## Features Implemented

### 1. Link Click Handling in Edit Mode ✅
- **Ctrl/Cmd + Click** to follow links even in edit mode
- Regular click in edit mode opens the editor
- Works for all editable wrappers and clickable content
- Tooltip shows "Click to edit • Ctrl+Click to follow link"

### 2. Universal Label Editing System ✅
- All website labels can be edited in edit mode
- Falls back to hardcoded translations if section doesn't exist
- Shows warning icon (⚠️) when section is missing
- Real-time updates across the site

### 3. New Hook: `useSectionLabel` ✅
Located at: `website/src/hooks/useSectionLabel.js`

**Usage:**
```javascript
import { useSectionLabel, SECTION_CODES } from '../hooks/useSectionLabel';

// In your component
const homeLabel = useSectionLabel(SECTION_CODES.HOME, 'home');

// Render it (shows editor in edit mode, plain text otherwise)
{homeLabel.renderEditable('css-classes-here')}

// Or just get the value
{homeLabel.value}
```

**Returns:**
- `value` - The text value (from database or fallback)
- `renderEditable()` - Function to render with edit mode support
- `hasSection` - Boolean indicating if section exists in database
- `sectionCode` - The section code used

## Section Code Convention

All section codes follow a naming convention:

- **Navigation**: `NAV_*` (NAV_HOME, NAV_PROJECTS, NAV_CONTACT)
- **Buttons**: `BTN_*` (BTN_SEND_MESSAGE, BTN_CLOSE, etc.)
- **Labels**: `LABEL_*` (LABEL_PROJECT_OVERVIEW, LABEL_DATE, etc.)
- **Messages**: `MSG_*` (MSG_LOADING_PROJECT, MSG_PROJECT_NOT_FOUND, etc.)
- **Social**: `SOCIAL_*` (SOCIAL_GITHUB, SOCIAL_LINKEDIN, etc.)
- **Forms**: `FORM_*` (FORM_NAME, FORM_EMAIL, etc.)
- **Special**: HERO_TAGLINE, CHAT_WITH_AI, DOWNLOAD_CV, YEARS_LABEL, FOOTER_COPYRIGHT

See `SECTION_CODES` constant in `useSectionLabel.js` for complete mapping.

## Components Updated

### 1. Header.js ✅
- Navigation links (Home, Projects, Contact) are now editable
- Falls back to translations if sections don't exist
- Shows warning icon in edit mode when sections are missing

### 2. Hero.js ✅
- "Years" label now editable (YEARS_LABEL section)
- Button labels already editable (CHAT_WITH_AI, DOWNLOAD_CV)
- Hero tagline already editable (HERO_TAGLINE)
- Experience cards support Ctrl+Click to navigate in edit mode

### 3. EditableWrapper.js ✅
- Added Ctrl/Cmd+Click support to follow links
- Updated all wrapper types (EditableWrapper, EditableTextWrapper)
- Added helpful tooltip text

## Database Setup

### Required Tables
- `sections` - Stores section definitions (code, timestamps)
- `section_texts` - Stores translations (section_id, language_id, text)
- `portfolio_sections` - Links sections to portfolios

### Creating Sections

Run the SQL script to create all label sections:

```bash
psql -U your_user -d your_database -f scripts/database/create_label_sections.sql
```

Or manually through the backend API (requires admin authentication).

### Section Structure

Each label requires:
1. A `sections` record with unique `code`
2. `section_texts` records for each language
3. Link to portfolio via `portfolio_sections`

Example:
```sql
-- Create section
INSERT INTO sections (code) VALUES ('NAV_HOME');

-- Add English text
INSERT INTO section_texts (section_id, language_id, text)
VALUES (
  (SELECT id FROM sections WHERE code = 'NAV_HOME'),
  (SELECT id FROM languages WHERE code = 'en'),
  'Home'
);

-- Add Spanish text
INSERT INTO section_texts (section_id, language_id, text)
VALUES (
  (SELECT id FROM sections WHERE code = 'NAV_HOME'),
  (SELECT id FROM languages WHERE code = 'es'),
  'Inicio'
);

-- Link to portfolio
INSERT INTO portfolio_sections (portfolio_id, section_id)
VALUES (1, (SELECT id FROM sections WHERE code = 'NAV_HOME'));
```

## Complete Section List

### Navigation (3)
- NAV_HOME
- NAV_PROJECTS
- NAV_CONTACT

### Hero Section (4)
- HERO_TAGLINE
- CHAT_WITH_AI
- DOWNLOAD_CV
- YEARS_LABEL

### Buttons (11)
- BTN_GET_IN_TOUCH
- BTN_BACK_TO_PROJECTS
- BTN_BACK_TO_HOME
- BTN_VIEW_LIVE_SITE
- BTN_VIEW_REPOSITORY
- BTN_VIEW_FULL_DETAILS
- BTN_SEND_MESSAGE
- BTN_SENDING
- BTN_PREVIOUS
- BTN_NEXT
- BTN_CLOSE

### Project Page (8)
- LABEL_PROJECT_OVERVIEW
- LABEL_SKILLS_TECHNOLOGIES
- LABEL_PROJECT_DETAILS
- LABEL_DATE
- LABEL_CATEGORY
- MSG_PROJECT_NOT_FOUND
- MSG_LOADING_PROJECT
- MSG_PROJECT_UNAVAILABLE

### Experience Page (4)
- LABEL_YEARS_EXPERIENCE
- LABEL_EXPERIENCE_OVERVIEW
- MSG_LOADING_EXPERIENCE
- LABEL_SKILL_LEVEL

### Contact Page (10)
- SOCIAL_GITHUB
- SOCIAL_LINKEDIN
- SOCIAL_TWITTER
- LABEL_CONTACT_FORM
- LABEL_CONTACT_DESCRIPTION
- FORM_NAME
- FORM_EMAIL
- FORM_SUBJECT
- FORM_MESSAGE
- LABEL_CONNECT_WITH_ME

### Footer (1)
- FOOTER_COPYRIGHT

**Total: 41 editable label sections**

## Edit Mode Workflow

### For Users
1. Enable edit mode (login required)
2. Hover over any label to see edit indicator
3. Click to edit the label
4. Or Ctrl/Cmd+Click to follow links
5. Changes save automatically to database

### For Missing Sections
If a section doesn't exist in the database:
- Label shows fallback text from `translations.js`
- Warning icon (⚠️) appears in edit mode
- Tooltip shows: "Create section with code 'SECTION_CODE' to edit"
- Run SQL script to create missing sections

## Migration Path

### Current State
- Some labels editable (hero tagline, button labels)
- Most labels hardcoded in `translations.js`
- No navigation label editing

### After Implementation
- ALL labels editable through CMS
- Database-driven content
- Fallback to translations if section missing
- No code changes needed to add translations

### Rollout Strategy
1. ✅ Run SQL script to create all sections
2. ✅ Test edit mode with created sections
3. ✅ Gradually migrate remaining components
4. Eventually remove `translations.js` (optional)

## Backward Compatibility

The system maintains full backward compatibility:
- If section doesn't exist → uses `translations.js`
- If section_text missing for language → uses `translations.js`
- Edit mode disabled → shows regular text
- No database → falls back gracefully

## Future Enhancements

Potential improvements:
1. Bulk section creation via admin panel
2. Export/import translations
3. Version history for label changes
4. Preview changes before saving
5. Approval workflow for label changes

## Technical Details

### Modifier Key Detection
```javascript
const isModifierClick = e.ctrlKey || e.metaKey;
if (isModifierClick) {
  // Allow link to be followed
  return;
}
// Otherwise, open editor
```

### Language Resolution
1. Check database for section with matching code
2. Get section_text for current language
3. Fallback to translations[language][key]
4. Fallback to key itself

### Performance
- Sections loaded once with portfolio data
- No additional API calls for labels
- Client-side fallback resolution
- Minimal overhead in view mode

## Testing Checklist

- [x] Navigation links editable
- [x] Button labels editable
- [x] Form labels ready (need component updates)
- [x] Page headings ready (need component updates)
- [x] Ctrl+Click works in edit mode
- [x] Fallback to translations works
- [x] Warning icons show for missing sections
- [x] Multiple languages supported
- [ ] All components migrated to use hook
- [ ] SQL script tested on production

## Support

For issues or questions:
1. Check if section exists in database
2. Verify section_texts for all languages
3. Check portfolio_sections link
4. Review browser console for errors
5. Verify edit mode is enabled
