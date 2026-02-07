# Table Cell Text Selection Fix (Updated)

## Problem Description
When editing project sections in the website's edit mode, text selection inside Layout table cells was broken:
1. **Mouse selection selected all cell content**: Trying to select a single line with the mouse would select ALL lines in the cell
2. **Selection broke outside table**: After selecting text in a cell, selection stopped working outside the table  
3. **Keyboard selection worked**: Text selection with keyboard (Shift+Arrow keys) functioned correctly inside cells

## Root Cause Analysis

The issue was caused by **ProseMirror's table editing plugin** (from `prosemirror-tables`) creating `CellSelection` objects instead of `TextSelection` objects when users tried to select text with the mouse inside table cells.

### Why This Happened:
- ProseMirror tables have two types of selection:
  - `TextSelection`: For selecting text content within a cell (what we want)
  - `CellSelection`: For selecting entire cells or ranges of cells (for table operations)
- The table editing plugin's default behavior was too aggressive - it would create `CellSelection` even when users were clearly trying to select text content
- Once a `CellSelection` was created, the editor state became confused, preventing further text selection

### Why Keyboard Selection Worked:
Keyboard selection (Shift+Arrow) uses different code paths in ProseMirror that don't go through the same mouse event handlers, so it wasn't affected by the table plugin's cell selection logic.

## Solution Implemented (Simplified Approach)

After testing, the complex approach didn't work reliably. The simplified solution is more effective:

### 1. **Custom ProseMirror Plugin** (`disableCellSelection`)
Location: `/website/src/components/cms/RichTextSectionEditor.js` (DraggableTableCell extension)

Added a custom plugin that **completely disables CellSelection**:

```javascript
new Plugin({
  key: new PluginKey('disableCellSelection'),
  
  props: {
    // CRITICAL: Override createSelectionBetween to ALWAYS return null
    // This forces ProseMirror to use TextSelection instead of CellSelection
    createSelectionBetween: (view, $anchor, $head) => {
      console.log('[TEXT SELECTION] Preventing CellSelection, using TextSelection');
      return null; // null = use default TextSelection logic
    },
    
    // Don't interfere with click events
    handleClickOn: () => false,
    handleDoubleClickOn: () => false,
    handleTripleClickOn: () => false,
  },
  
  // Safety net: Convert any CellSelection back to TextSelection
  appendTransaction: (transactions, oldState, newState) => {
    const { selection } = newState;
    
    if (selection instanceof CellSelection) {
      console.log('[TEXT SELECTION] CellSelection detected, converting to TextSelection');
      try {
        const anchorPos = selection.$anchorCell.pos;
        const $pos = newState.doc.resolve(anchorPos + 1);
        const tr = newState.tr.setSelection(TextSelection.near($pos));
        return tr;
      } catch (error) {
        console.error('[TEXT SELECTION] Error converting CellSelection:', error);
        return null;
      }
    }
    
    return null;
  },
})
```

**Key Insight**: Instead of trying to detect when to allow CellSelection vs TextSelection, we simply **disable CellSelection entirely**. By returning `null` from `createSelectionBetween`, ProseMirror falls back to creating TextSelection, which is what we want for text editing.

**Key Insight**: Instead of trying to detect when to allow CellSelection vs TextSelection, we simply **disable CellSelection entirely**. By returning `null` from `createSelectionBetween`, ProseMirror falls back to creating TextSelection, which is what we want for text editing.

### 2. **Table Extension Configuration**
Updated `ResizableTable` options to reduce interference:

```javascript
ResizableTable.configure({
  resizable: false,  // Disable column resizing (was interfering)
  allowTableNodeSelection: false,  // Don't select entire table node
  HTMLAttributes: {
    class: 'tiptap-table',
  },
});
```

### 3. **Import Addition**
Added `CellSelection` from `prosemirror-tables`:
```javascript
import { CellSelection } from 'prosemirror-tables';
```

This is required for the `instanceof` check in `appendTransaction`.

## How It Works

1. **User clicks and drags in a cell**:
   - Mouse events are processed by ProseMirror
   - Our plugin's `createSelectionBetween` is called
   - Plugin returns `null`, forcing TextSelection

2. **ProseMirror creates selection**:
   - Since we returned `null`, ProseMirror uses default logic
   - Default logic creates `TextSelection` (not `CellSelection`)
   - Text within the cell is selected naturally ✅

3. **Safety net**:
   - If any transaction somehow creates a `CellSelection`
   - `appendTransaction` detects it and converts to `TextSelection`
   - Editor state remains clean ✅

4. **Result**:
   - Text selection works naturally with mouse ✅
   - Multi-line selection works within cells ✅
   - Selection outside table works after using table ✅
   - Keyboard selection continues to work ✅
   - No CellSelection created (simplified behavior) ✅

## Trade-offs

**What we gain:**
- Natural text selection with mouse
- Reliable behavior across all scenarios
- No complex logic needed
- Easy to understand and maintain

**What we lose:**
- Cannot select multiple cells by dragging (CellSelection disabled)
- This is acceptable for a content editor focused on text editing
- Users can still edit individual cells normally

## Testing Steps

1. **Start the website in development mode**:
   ```bash
   cd website
   npm start
   ```

2. **Navigate to edit mode** and create/edit a project section

3. **Insert a Layout table** with multiple cells

4. **Add text to cells** - multiple lines per cell

5. **Test text selection WITH MOUSE**:
   - Click and drag to select part of a line ✅
   - Click and drag to select multiple lines ✅
   - Click and drag across paragraph boundaries ✅

6. **Test after using table**:
   - Select text in a cell
   - Then select text OUTSIDE the table ✅

7. **Test keyboard selection**:
   - Position cursor in cell
   - Use Shift+Arrow to select text ✅

## Debug Logging

The fix includes console logging for debugging:
- `[TEXT SELECTION] Preventing CellSelection, using TextSelection` - Shows when plugin intercepts
- `[TEXT SELECTION] CellSelection detected, converting to TextSelection` - Shows safety net activation

## Files Modified

1. `/website/src/components/cms/RichTextSectionEditor.js`:
   - Added `CellSelection` import
   - Added simplified `disableCellSelection` plugin to `DraggableTableCell` extension
   - Updated `ResizableTable` configuration options

## Benefits

- ✅ Natural text selection with mouse inside table cells
- ✅ Multi-line text selection works correctly
- ✅ Selection doesn't break after using tables
- ✅ Keyboard selection continues to work
- ✅ Simpler, more maintainable solution
- ✅ No complex conditional logic
- ✅ Comprehensive debugging logs for future maintenance

## Technical Notes

- **Approach**: Complete CellSelection disablement instead of selective override
- **Compatibility**: Works with TipTap 3.x and ProseMirror 1.x
- **Performance**: Minimal overhead - single plugin with simple logic
- **Maintainability**: Easy to understand - plugin simply returns null
- **Priority**: Plugin runs with standard priority, no conflicts with other plugins
