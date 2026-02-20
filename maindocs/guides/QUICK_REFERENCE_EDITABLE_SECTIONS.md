# Quick Reference: Editable Website Sections

## How to Edit Website Content

### 1. Enable Edit Mode
1. Log in to the backend admin panel at `/admin`
2. Click the "Edit Website" button
3. The website opens in a new tab with edit mode enabled
4. You'll see an edit mode indicator at the top

### 2. Edit Section Labels (Buttons, Titles, Labels)
- **Click directly on any text** in edit mode
- Text that's editable will show a subtle indicator on hover
- Type your changes
- Press **Enter** or click outside to save
- Changes save automatically to the database

### 3. Edit Project Data
- **On Projects Page:**
  - Click a project card to open the modal
  - Click on the project name or description to edit
  - Make your changes and save

- **On Project Details Page:**
  - Click on the project title to edit
  - Click on the description to edit (multiline support)
  - All changes save to the database

### 4. Switch Languages
- Use the language switcher in the header
- Each language has separate editable text
- Edit content for each language independently

### 5. Exit Edit Mode
- Click "Exit Edit Mode" in the indicator at the top
- Or close the tab and return to the admin panel

## What Can Be Edited

### Projects Section
- ✏️ "Projects" section title
- ✏️ "Loading projects..." message
- ✏️ Project names (in modal and detail page)
- ✏️ Project descriptions
- ✏️ "View Full Details" button
- ✏️ "Close" button

### Project Details Page
- ✏️ "Back to Projects" button
- ✏️ "Previous" / "Next" buttons
- ✏️ Project title and description
- ✏️ "Project Overview" heading
- ✏️ "Skills & Technologies" heading
- ✏️ "Project Details" heading
- ✏️ "Date" and "Category" labels
- ✏️ "View Live Site" button
- ✏️ "View Repository" button

### Contact Section (Homepage)
- ✏️ "Get in Touch" title
- ✏️ Social media labels

### Contact Page
- ✏️ "Get in Touch" title
- ✏️ Description text
- ✏️ Form labels: Name, Email, Subject, Message
- ✏️ "Send Message" button
- ✏️ "Sending..." state
- ✏️ "Connect With Me" title
- ✏️ Social media labels

### Footer
- ✏️ Copyright text (use `{year}` for current year)

## Tips & Best Practices

### Using Placeholders
- **Year in footer:** Use `{year}` in the copyright text
  - Example: `© {year} Your Name. All rights reserved.`
  - It will automatically show the current year when not in edit mode

### Editing Project Content
- **Names:** Keep them concise (2-5 words)
- **Descriptions:** Can be longer, but keep them readable
- **Brief/Overview:** Separate sections for short and detailed descriptions

### Multilingual Content
- Edit each language separately
- Keep translations consistent in tone and length
- Test both languages before finalizing changes

### Saving Changes
- Changes save automatically when you:
  - Press Enter
  - Click outside the editor
  - Switch to another field
- Watch for the save indicator (brief animation)
- If a save fails, you'll see an error message

### Visual Indicators
- **Green highlight:** Editable in edit mode
- **Yellow warning icon:** Section not found (contact admin)
- **Loading spinner:** Save in progress

## Keyboard Shortcuts (in editors)

- **Enter:** Save single-line fields
- **Shift+Enter:** New line in multiline fields
- **Escape:** Cancel editing (revert changes)
- **Tab:** Move to next field

## Troubleshooting

### "Section not found" warning
- The section hasn't been created in the database
- Contact your administrator to run the populate script

### Changes not saving
1. Check your internet connection
2. Verify you're still logged in (check edit mode indicator)
3. Try refreshing the page and editing again
4. Contact administrator if problem persists

### Text looks wrong after editing
- Click on it again to re-edit
- Or refresh the page to see the saved version
- Changes are stored in the database, not lost

### Can't find something to edit
- Make sure edit mode is enabled (indicator at top)
- Some sections might not be editable yet
- Contact administrator to request new editable sections

## For Administrators

### Add New Editable Sections
1. Add section code to `populate_website_sections.py`
2. Run the script: `python scripts/populate_website_sections.py`
3. Update the component to use `useSectionLabel` hook
4. Test in edit mode

### View All Sections
```sql
SELECT s.code, st.language_id, l.code as lang, st.text 
FROM sections s 
JOIN section_texts st ON s.id = st.section_id 
JOIN languages l ON st.language_id = l.id 
ORDER BY s.code, l.code;
```

### Backup Sections
```bash
pg_dump -h localhost -U admindb -t sections -t section_texts portfolioai_dev > sections_backup.sql
```

## API Reference

### Update Section Text
```
PUT /api/sections/text/{section_text_id}
Content-Type: application/json
Authorization: Bearer {token}

{
  "text": "New text content"
}
```

### Update Project Text
```
PUT /api/projects/text/{project_text_id}
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "New Project Name",
  "description": "New description"
}
```

## Support

For issues or questions:
1. Check the main documentation: `EDITABLE_WEBSITE_SECTIONS_COMPLETE.md`
2. Check browser console for error messages
3. Contact your system administrator
4. Review the implementation guide for developers
