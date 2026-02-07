import React, { useState, useEffect, useRef } from 'react';
import { FaPlus, FaTrash, FaTimes, FaImage, FaFile, FaEdit, FaUpload, FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import { portfolioApi } from '../../services/portfolioApi';
import { useEditMode } from '../../context/EditModeContext';
import RichTextSectionEditor from './RichTextSectionEditorV2';

/**
 * ConfirmDialog Component
 * Elegant confirmation dialog with theme styling
 */
const ConfirmDialog = ({ isOpen, onConfirm, onCancel, title, message, confirmText = 'Delete', cancelText = 'Cancel', isDanger = true }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-900 border border-gray-700/50 rounded-xl p-6 max-w-md w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className={`p-2 rounded-lg ${isDanger ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
            <FaExclamationTriangle size={24} />
          </div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>

        <p className="text-gray-300 mb-6 leading-relaxed">{message}</p>

        <div className="flex gap-3">
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 rounded font-semibold transition-all duration-200 ${
              isDanger
                ? 'bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 hover:border-red-500 text-red-400 hover:text-red-300'
                : 'bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/50 hover:border-blue-500 text-blue-400 hover:text-blue-300'
            }`}
          >
            {confirmText}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 rounded font-semibold bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 hover:border-gray-600 text-gray-300 hover:text-white transition-all duration-200"
          >
            {cancelText}
          </button>
        </div>
      </div>
    </div>
  );
};

/**
 * ProjectSectionManager Component
 * Manages sections for a project in edit mode with image and file upload
 */
const ProjectSectionManager = ({ project, onUpdate }) => {
  const { authToken } = useEditMode();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingSection, setEditingSection] = useState(null);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  // Load project sections
  useEffect(() => {
    if (project?.id) {
      loadSections();
    }
  }, [project?.id]);

  const loadSections = async () => {
    try {
      setLoading(true);
      const data = await portfolioApi.getProjectSections(project.id, authToken);
      // Add timestamp to images to prevent caching issues
      const sectionsWithTimestamp = (data || []).map(section => ({
        ...section,
        images: (section.images || []).map(img => ({
          ...img,
          _loadTimestamp: Date.now()
        }))
      }));
      setSections(sectionsWithTimestamp);
    } catch (err) {
      console.error('Error loading sections:', err);
      setError('Failed to load sections');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveSection = (sectionId) => {
    setConfirmDelete({
      type: 'section',
      id: sectionId,
      title: 'Remove Section',
      message: 'Are you sure you want to remove this section from the project? This will not delete the section itself, only remove it from this project.',
    });
  };

  const confirmRemoveSection = async () => {
    if (!confirmDelete) return;

    try {
      await portfolioApi.removeSectionFromProject(project.id, confirmDelete.id, authToken);
      await loadSections();
      if (onUpdate) onUpdate();
      setConfirmDelete(null);
    } catch (err) {
      console.error('Error removing section:', err);
      setError('Failed to remove section');
      setConfirmDelete(null);
    }
  };

  const handleEditSection = (section) => {
    setEditingSection(section);
  };

  const handleSectionUpdated = async () => {
    await loadSections();
    if (onUpdate) onUpdate();
    setEditingSection(null);
  };

  // Force refresh sections when dialog closes (to get updated images)
  const handleCloseDialog = () => {
    setShowAddDialog(false);
    loadSections(); // Refresh to get latest data
  };

  const handleEditClose = () => {
    setEditingSection(null);
    loadSections(); // Refresh to get latest data
  };

  return (
    <div className="mt-8 border-t border-gray-700/50 pt-8">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-white">Project Sections</h3>
        <button
          onClick={() => setShowAddDialog(true)}
          className="btn-flat btn-flat-sm flex items-center gap-2"
        >
          <FaPlus />
          <span>Add Section</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-gray-400">Loading sections...</div>
      ) : sections.length === 0 ? (
        <div className="bg-gray-800/30 rounded-xl p-8 text-center border border-gray-700/50">
          <p className="text-gray-400 mb-2">No sections added yet.</p>
          <p className="text-sm text-gray-500">Sections allow you to add rich content with text, images, and downloadable files.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {sections
            .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
            .map((section) => {
              const sectionText = section.section_texts?.[0];
              
              // Determine if section should have borders
              const isBordered = section.display_style !== 'borderless';
              const containerClasses = isBordered
                ? "bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 relative"
                : "relative p-6";
              
              return (
                <div
                  key={section.id}
                  className={containerClasses}
                >
                  {/* Edit controls */}
                  <div className="absolute top-4 right-4 flex gap-2 bg-gray-900/90 p-2 rounded border border-gray-700/50">
                    <button
                      onClick={() => handleEditSection(section)}
                      className="text-blue-400 hover:text-blue-300 p-2"
                      title="Edit section"
                    >
                      <FaEdit />
                    </button>
                    <button
                      onClick={() => handleRemoveSection(section.id)}
                      className="text-red-400 hover:text-red-300 p-2"
                      title="Remove section"
                    >
                      <FaTrash />
                    </button>
                  </div>

                  {/* Section metadata */}
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
                      {section.code}
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-1 rounded">
                      Order: {section.display_order || 0}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      isBordered 
                        ? 'bg-blue-500/20 text-blue-400 border border-blue-500/50' 
                        : 'bg-purple-500/20 text-purple-400 border border-purple-500/50'
                    }`}>
                      {isBordered ? 'Bordered' : 'Borderless'}
                    </span>
                  </div>

                  {/* Section content preview */}
                  {sectionText && (
                    <div className="prose prose-lg prose-invert max-w-none mb-4">
                      <p className="text-gray-300 whitespace-pre-wrap leading-relaxed">
                        {sectionText.text}
                      </p>
                    </div>
                  )}

                  {/* Section images */}
                  {section.images && section.images.length > 0 && (
                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {section.images
                        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                        .map((image) => {
                          // Remove leading slash to avoid double slashes
                          const cleanPath = image.image_path.startsWith('/') 
                            ? image.image_path.substring(1) 
                            : image.image_path;
                          const imageUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${cleanPath}`;
                          // Add timestamp to prevent caching issues
                          const timestamp = image._uploadTimestamp || image._loadTimestamp || Date.now();
                          const timestampedUrl = `${imageUrl}?t=${timestamp}`;
                          
                          return (
                            <img
                              key={image.id}
                              src={timestampedUrl}
                              alt="Section diagram"
                              className="w-full rounded-lg border border-gray-700/50"
                              onError={(e) => {
                                console.error('Failed to load section image:', image.image_path, 'URL:', timestampedUrl);
                              }}
                            />
                          );
                        })}
                    </div>
                  )}

                  {/* Section attachments - Elegant Box Design */}
                  {section.attachments && section.attachments.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3 flex items-center gap-2">
                        <FaFile className="text-[#14C800]" size={14} />
                        Downloads
                      </h4>
                      <div className="space-y-3">
                        {section.attachments
                          .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                          .map((attachment) => {
                            // Remove leading slash to avoid double slashes
                            const cleanPath = attachment.file_path.startsWith('/') 
                              ? attachment.file_path.substring(1) 
                              : attachment.file_path;
                            const fileUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${cleanPath}`;
                            
                            // Extract file extension and size
                            const fileExt = attachment.file_name.split('.').pop().toUpperCase();
                            const fileSize = attachment.file_size 
                              ? `${(attachment.file_size / 1024).toFixed(1)} KB`
                              : 'Unknown size';
                            
                            return (
                              <div
                                key={attachment.id}
                                className="group relative bg-gradient-to-br from-gray-800/60 to-gray-900/60 border border-gray-700/50 hover:border-[#14C800]/50 rounded-lg overflow-hidden transition-all duration-300 hover:shadow-lg hover:shadow-[#14C800]/10"
                              >
                                {/* Top accent line */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#14C800]/40 via-[#14C800]/60 to-[#14C800]/40 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                                
                                <a
                                  href={fileUrl}
                                  download={attachment.file_name}
                                  className="flex items-center gap-4 p-4 no-underline"
                                >
                                  {/* File icon with extension badge */}
                                  <div className="relative flex-shrink-0">
                                    <div className="w-12 h-12 rounded-lg bg-[#14C800]/10 border border-[#14C800]/30 flex items-center justify-center group-hover:bg-[#14C800]/20 group-hover:border-[#14C800]/50 transition-all duration-300">
                                      <FaFile className="text-[#14C800] text-xl group-hover:scale-110 transition-transform duration-300" />
                                    </div>
                                    {/* Extension badge */}
                                    <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-gray-900 border border-[#14C800]/40 rounded text-[9px] font-bold text-[#14C800] uppercase">
                                      {fileExt}
                                    </div>
                                  </div>
                                  
                                  {/* File info */}
                                  <div className="flex-1 min-w-0">
                                    <h5 className="text-white font-medium text-sm truncate group-hover:text-[#14C800] transition-colors duration-200">
                                      {attachment.file_name}
                                    </h5>
                                    <p className="text-gray-400 text-xs mt-0.5 flex items-center gap-2">
                                      <span>{fileSize}</span>
                                      {attachment.description && (
                                        <>
                                          <span className="text-gray-600">•</span>
                                          <span className="truncate">{attachment.description}</span>
                                        </>
                                      )}
                                    </p>
                                  </div>
                                  
                                  {/* Download icon */}
                                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#14C800]/10 border border-[#14C800]/30 flex items-center justify-center group-hover:bg-[#14C800] group-hover:border-[#14C800] transition-all duration-300">
                                    <svg className="w-4 h-4 text-[#14C800] group-hover:text-gray-900 transition-colors duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                  </div>
                                </a>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {showAddDialog && (
        <SectionEditorDialog
          projectId={project.id}
          authToken={authToken}
          onClose={handleCloseDialog}
          onSuccess={async () => {
            setShowAddDialog(false);
            await loadSections();
            if (onUpdate) onUpdate();
          }}
        />
      )}

      {editingSection && (
        <SectionEditorDialog
          projectId={project.id}
          section={editingSection}
          authToken={authToken}
          onClose={handleEditClose}
          onSuccess={handleSectionUpdated}
        />
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!confirmDelete && confirmDelete.type === 'section'}
        onConfirm={confirmRemoveSection}
        onCancel={() => setConfirmDelete(null)}
        title={confirmDelete?.title || 'Confirm'}
        message={confirmDelete?.message || 'Are you sure?'}
      />
    </div>
  );
};

/**
 * SectionEditorDialog Component
 * Dialog for creating/editing sections with image and file upload
 */
const SectionEditorDialog = ({ projectId, section, authToken, onClose, onSuccess }) => {
  const isEditing = !!section;
  const [formData, setFormData] = useState({
    code: section?.code || '',
    section_texts: section?.section_texts || [{ language_id: 1, text: '' }],
    display_order: section?.display_order || 0,
    display_style: section?.display_style || 'bordered',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Image and attachment state (managed by RichTextSectionEditor)
  const [images, setImages] = useState(section?.images || []);
  const [attachments, setAttachments] = useState(section?.attachments || []);
  const [pendingFiles, setPendingFiles] = useState([]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!formData.code.trim()) {
      setError('Section code is required');
      return;
    }

    // Get the latest HTML directly from the editor ref if available
    // This ensures we capture any recent changes including images
    const editorElement = document.querySelector('.ProseMirror');
    let currentHtml = formData.section_texts[0].text;
    
    if (editorElement) {
      // Extract HTML from the editor DOM
      currentHtml = editorElement.innerHTML;
      console.log('[SUBMIT] Captured HTML directly from editor, length:', currentHtml.length);
      console.log('[SUBMIT] HTML contains base64:', currentHtml.includes('data:image'));
      
      // CRITICAL: Clean inline border styles from borderless table cells before saving
      // This ensures borders don't persist in display mode
      // Use regex to clean the HTML string directly - more reliable than DOM manipulation
      // Check for borderless in multiple ways - the class might be on the table inside tableWrapper
      const hasBorderless = currentHtml.includes('borderless') || 
                           currentHtml.includes('data-borderless-cell') ||
                           currentHtml.includes('border: 1px dashed') ||
                           currentHtml.includes('rgba(148, 163, 184, 0.5)');
      console.log('[SUBMIT] Checking for borderless tables:', hasBorderless);
      console.log('[SUBMIT] HTML contains "borderless":', currentHtml.includes('borderless'));
      console.log('[SUBMIT] HTML contains "data-borderless-cell":', currentHtml.includes('data-borderless-cell'));
      console.log('[SUBMIT] HTML contains dashed border:', currentHtml.includes('border: 1px dashed'));
      
      if (hasBorderless) {
        console.log('[SUBMIT] Starting HTML cleaning...');
        console.log('[SUBMIT] HTML before cleaning (first 500 chars):', currentHtml.substring(0, 500));
        
        // Remove data-borderless-cell attribute
        currentHtml = currentHtml.replace(/\s+data-borderless-cell="[^"]*"/gi, '');
        currentHtml = currentHtml.replace(/\s+data-borderless-cell='[^']*'/gi, '');
        
        // Remove table-cell-droppable class
        currentHtml = currentHtml.replace(/\s+class="[^"]*table-cell-droppable[^"]*"/gi, (match) => {
          const cleaned = match.replace(/\s*table-cell-droppable\s*/gi, ' ').trim();
          return cleaned === 'class=""' ? '' : cleaned;
        });
        currentHtml = currentHtml.replace(/\s+class='[^']*table-cell-droppable[^']*'/gi, (match) => {
          const cleaned = match.replace(/\s*table-cell-droppable\s*/gi, ' ').trim();
          return cleaned === "class=''" ? '' : cleaned;
        });
        
        // Remove border and background styles from style attributes using regex
        // This function cleans a style string by removing all border and background properties
        const cleanStyleString = (styleContent) => {
          if (!styleContent) return '';
          
          // Split by semicolon and filter out border/background properties
          const properties = styleContent.split(';')
            .map(prop => prop.trim())
            .filter(prop => {
              if (!prop) return false; // Remove empty strings
              const lower = prop.toLowerCase();
              // Remove any property that mentions border or background
              return !lower.includes('border') && !lower.includes('background');
            });
          
          // Join back and clean up
          let cleaned = properties.join(';')
            .replace(/;;+/g, ';')
            .replace(/^\s*;\s*|\s*;\s*$/g, '')
            .trim();
          
          return cleaned;
        };
        
        // Count how many style attributes we're cleaning
        const styleMatches = (currentHtml.match(/style="[^"]*"/gi) || []).length;
        console.log('[SUBMIT] Found', styleMatches, 'style attributes to clean');
        
        // Clean double-quoted style attributes - do multiple passes to be sure
        let previousHtml = '';
        let iterations = 0;
        while (previousHtml !== currentHtml && iterations < 5) {
          previousHtml = currentHtml;
          currentHtml = currentHtml.replace(/style="([^"]*)"/gi, (match, styleContent) => {
            const cleaned = cleanStyleString(styleContent);
            return cleaned ? `style="${cleaned}"` : '';
          });
          iterations++;
        }
        
        // Clean single-quoted style attributes - do multiple passes to be sure
        previousHtml = '';
        iterations = 0;
        while (previousHtml !== currentHtml && iterations < 5) {
          previousHtml = currentHtml;
          currentHtml = currentHtml.replace(/style='([^']*)'/gi, (match, styleContent) => {
            const cleaned = cleanStyleString(styleContent);
            return cleaned ? `style='${cleaned}'` : '';
          });
          iterations++;
        }
        
        // Clean up empty style attributes
        currentHtml = currentHtml.replace(/\s+style="\s*"/gi, '');
        currentHtml = currentHtml.replace(/\s+style='\s*'/gi, '');
        
        // Verify cleaning worked - check if border styles are still present
        const hasBorderStyles = currentHtml.includes('border') && 
                                (currentHtml.includes('dashed') || currentHtml.includes('rgba(148, 163, 184'));
        const hasBackgroundStyles = currentHtml.includes('background-color: rgba(30, 41, 59');
        
        console.log('[SUBMIT] Cleaned HTML, new length:', currentHtml.length);
        console.log('[SUBMIT] Has border styles after cleaning:', hasBorderStyles);
        console.log('[SUBMIT] Has background styles after cleaning:', hasBackgroundStyles);
        
        if (hasBorderStyles || hasBackgroundStyles) {
          console.warn('[SUBMIT] ⚠️ Border/background styles still present after cleaning!');
          console.warn('[SUBMIT] Attempting aggressive removal...');
          
          // AGGRESSIVE: Remove entire style attribute if it contains border or background
          // This is a last resort to ensure borders don't persist
          currentHtml = currentHtml.replace(/style="[^"]*border[^"]*"/gi, (match) => {
            const styleContent = match.replace(/style="|"/g, '');
            const cleaned = cleanStyleString(styleContent);
            // If cleaned is empty or still contains border/background, remove entire attribute
            if (!cleaned || cleaned.includes('border') || cleaned.includes('background')) {
              return '';
            }
            return `style="${cleaned}"`;
          });
          
          currentHtml = currentHtml.replace(/style='[^']*border[^']*'/gi, (match) => {
            const styleContent = match.replace(/style='|'/g, '');
            const cleaned = cleanStyleString(styleContent);
            // If cleaned is empty or still contains border/background, remove entire attribute
            if (!cleaned || cleaned.includes('border') || cleaned.includes('background')) {
              return '';
            }
            return `style='${cleaned}'`;
          });
          
          // Also remove style attributes that contain background-color with our specific color
          currentHtml = currentHtml.replace(/style="[^"]*background-color:\s*rgba\(30,\s*41,\s*59[^"]*"/gi, '');
          currentHtml = currentHtml.replace(/style='[^']*background-color:\s*rgba\(30,\s*41,\s*59[^']*'/gi, '');
          
          // Final check
          const stillHasBorders = currentHtml.includes('border') && currentHtml.includes('dashed');
          if (stillHasBorders) {
            console.error('[SUBMIT] ❌ CRITICAL: Border styles STILL present after aggressive cleaning!');
            // Last resort: remove ALL style attributes from td/th elements that contain border or background
            // Only target cells that have border/background in their style
            currentHtml = currentHtml.replace(/<td([^>]*style="[^"]*border[^"]*"[^>]*)>/gi, (match, attrs) => {
              return '<td' + attrs.replace(/\s+style="[^"]*"/gi, '') + '>';
            });
            currentHtml = currentHtml.replace(/<th([^>]*style="[^"]*border[^"]*"[^>]*)>/gi, (match, attrs) => {
              return '<th' + attrs.replace(/\s+style="[^"]*"/gi, '') + '>';
            });
            currentHtml = currentHtml.replace(/<td([^>]*style='[^']*border[^']*'[^>]*)>/gi, (match, attrs) => {
              return '<td' + attrs.replace(/\s+style='[^']*'/gi, '') + '>';
            });
            currentHtml = currentHtml.replace(/<th([^>]*style='[^']*border[^']*'[^>]*)>/gi, (match, attrs) => {
              return '<th' + attrs.replace(/\s+style='[^']*'/gi, '') + '>';
            });
            
            // Also remove style attributes with background-color
            currentHtml = currentHtml.replace(/<td([^>]*style="[^"]*background[^"]*"[^>]*)>/gi, (match, attrs) => {
              return '<td' + attrs.replace(/\s+style="[^"]*"/gi, '') + '>';
            });
            currentHtml = currentHtml.replace(/<th([^>]*style="[^"]*background[^"]*"[^>]*)>/gi, (match, attrs) => {
              return '<th' + attrs.replace(/\s+style="[^"]*"/gi, '') + '>';
            });
            currentHtml = currentHtml.replace(/<td([^>]*style='[^']*background[^']*'[^>]*)>/gi, (match, attrs) => {
              return '<td' + attrs.replace(/\s+style='[^']*'/gi, '') + '>';
            });
            currentHtml = currentHtml.replace(/<th([^>]*style='[^']*background[^']*'[^>]*)>/gi, (match, attrs) => {
              return '<th' + attrs.replace(/\s+style='[^']*'/gi, '') + '>';
            });
          }
        }
        
        // Final verification
        const finalCheck = currentHtml.includes('border') && currentHtml.includes('dashed');
        console.log('[SUBMIT] Final check - Has border styles:', finalCheck);
        if (!finalCheck) {
          console.log('[SUBMIT] ✅ Successfully removed all border styles!');
        } else {
          console.error('[SUBMIT] ❌ Border styles STILL present! HTML sample:', currentHtml.substring(0, 1000));
        }
        
        console.log('[SUBMIT] HTML after cleaning (first 500 chars):', currentHtml.substring(0, 500));
      }
      
      // Log a sample of the HTML to see structure
      if (currentHtml.includes('data:image')) {
        const imgMatch = currentHtml.match(/<img[^>]*data:image[^>]*>/i);
        if (imgMatch) {
          console.log('[SUBMIT] Sample img tag:', imgMatch[0].substring(0, 200) + '...');
        }
      }
    }

    // Check if section has meaningful content (not just empty HTML tags or placeholder)
    const textContent = currentHtml;
    
    console.log('[VALIDATION] Raw text content:', textContent);
    
    // Remove placeholder text for validation
    const contentWithoutPlaceholder = textContent.replace('Start writing your section content here...', '');
    
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = contentWithoutPlaceholder;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    
    console.log('[VALIDATION] Plain text extracted:', plainText);
    console.log('[VALIDATION] Plain text trimmed length:', plainText.trim().length);
    
    // Also check if there are any images or code blocks (even if no plain text)
    const hasImages = contentWithoutPlaceholder.includes('<img') || images.length > 0;
    const hasCodeBlocks = contentWithoutPlaceholder.includes('code-block-wrapper') || contentWithoutPlaceholder.includes('<pre');
    const hasFiles = pendingFiles.length > 0 || attachments.length > 0;
    
    console.log('[VALIDATION] Has images:', hasImages, 'Has code blocks:', hasCodeBlocks, 'Has files:', hasFiles);
    
    if (!plainText.trim() && !hasImages && !hasCodeBlocks && !hasFiles) {
      console.log('[VALIDATION] Failed - no content detected');
      setError('Section text is required');
      return;
    }
    
    console.log('[VALIDATION] Passed - content is valid');

    try {
      setLoading(true);
      if (isEditing) {
        // Update existing section - only send expected fields
        // Use currentHtml which was captured from the editor
        const sectionData = {
          code: formData.code,
          section_texts: [{ language_id: 1, text: currentHtml }],
          display_order: formData.display_order,
          display_style: formData.display_style
        };
        console.log('[UPDATE SECTION] Sending data:', sectionData);
        await portfolioApi.updateSection(section.id, sectionData, authToken);
        
        // If display_order changed and we have a projectId, update the order separately
        if (projectId && formData.display_order !== section.display_order) {
          console.log(`[SECTION EDIT] Updating display_order for section ${section.id} in project ${projectId} to ${formData.display_order}`);
          await portfolioApi.updateSectionDisplayOrder(projectId, section.id, formData.display_order, authToken);
        }
      } else {
        // Create new section - only send fields expected by backend
        // Use currentHtml which was captured from the editor
        const sectionData = {
          code: formData.code,
          section_texts: [{ language_id: 1, text: currentHtml }],
          display_order: formData.display_order,
          display_style: formData.display_style
        };
        console.log('[CREATE SECTION] Sending data:', sectionData);
        const response = await portfolioApi.createProjectSection(projectId, sectionData, authToken);
        const newSectionId = response.id || response.section_id;
        console.log('[CREATE SECTION] Created section with ID:', newSectionId);
        
        // Extract and upload base64 images from HTML
        let updatedHtml = currentHtml;
        console.log('[IMAGE UPLOAD] Checking HTML for base64 images, HTML length:', updatedHtml.length);
        console.log('[IMAGE UPLOAD] HTML preview:', updatedHtml.substring(0, 500));
        
        // Check if HTML contains base64 images
        const hasBase64 = updatedHtml.includes('data:image');
        console.log('[IMAGE UPLOAD] Contains "data:image":', hasBase64);
        
        // More flexible regex to match base64 images with any attribute order
        // This matches: src="data:image/TYPE;base64,DATA" or src='data:image/TYPE;base64,DATA'
        const base64ImageRegex = /src\s*=\s*["']data:image\/([^;]+);base64,([^"']+)["']/gi;
        const base64Images = [];
        let match;
        
        console.log('[IMAGE UPLOAD] Testing regex on HTML...');
        
        while ((match = base64ImageRegex.exec(updatedHtml)) !== null) {
          console.log('[IMAGE UPLOAD] Found base64 image match:', match[1], 'data length:', match[2].length);
          base64Images.push({
            fullMatch: match[0],
            format: match[1],
            data: match[2]
          });
        }
        
        console.log('[IMAGE UPLOAD] Total base64 images found:', base64Images.length);
        
        if (base64Images.length > 0 && newSectionId) {
          console.log(`[IMAGE UPLOAD] Starting upload of ${base64Images.length} base64 image(s)`);
          
          for (const img of base64Images) {
            try {
              // Convert base64 to blob
              const byteString = atob(img.data);
              const ab = new ArrayBuffer(byteString.length);
              const ia = new Uint8Array(ab);
              for (let i = 0; i < byteString.length; i++) {
                ia[i] = byteString.charCodeAt(i);
              }
              const blob = new Blob([ab], { type: `image/${img.format}` });
              const file = new File([blob], `image-${Date.now()}.${img.format}`, { type: `image/${img.format}` });
              
              // Upload the image
              const uploadResponse = await portfolioApi.uploadImage(
                file,
                'section',
                newSectionId,
                'section',
                authToken
              );
              
              const cleanPath = uploadResponse.image_path?.startsWith('/') 
                ? uploadResponse.image_path.substring(1) 
                : uploadResponse.image_path;
              const imageUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${cleanPath}`;
              
              // Replace base64 with actual URL in HTML
              const srcPattern = new RegExp(img.fullMatch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
              updatedHtml = updatedHtml.replace(srcPattern, `src="${imageUrl}"`);
              
              console.log(`[IMAGE UPLOAD] Successfully uploaded image, URL: ${imageUrl}`);
            } catch (uploadErr) {
              console.error(`[IMAGE UPLOAD] Failed to upload base64 image:`, uploadErr);
            }
          }
          
          // Update section with new HTML containing real image URLs
          if (updatedHtml !== formData.section_texts[0].text) {
            try {
              await portfolioApi.updateSection(newSectionId, {
                section_texts: [{ language_id: 1, text: updatedHtml }]
              }, authToken);
              console.log('[IMAGE UPLOAD] Updated section HTML with real image URLs');
            } catch (updateErr) {
              console.error('[IMAGE UPLOAD] Failed to update section HTML:', updateErr);
            }
          }
        }
        
        // Upload pending files if any
        if (pendingFiles && pendingFiles.length > 0 && newSectionId) {
          console.log(`[FILE UPLOAD] Uploading ${pendingFiles.length} pending file(s) for new section ${newSectionId}`);
          
          const uploadResults = [];
          const uploadErrors = [];
          
          for (const pendingFile of pendingFiles) {
            try {
              const uploadResponse = await portfolioApi.uploadAttachment(
                pendingFile.file,
                'section',
                newSectionId,
                authToken
              );
              uploadResults.push({
                name: pendingFile.name,
                success: true,
                response: uploadResponse,
                originalSize: pendingFile.size // Store original file size
              });
            } catch (uploadErr) {
              console.error(`Failed to upload ${pendingFile.name}:`, uploadErr);
              uploadErrors.push({
                name: pendingFile.name,
                error: uploadErr.message || 'Upload failed'
              });
            }
          }
          
          // Insert file links into the section HTML for successfully uploaded files
          if (uploadResults.length > 0) {
            try {
              // Build HTML for elegant file links
              const fileLinksHtml = uploadResults.map(result => {
                const cleanPath = result.response.file_path?.startsWith('/') 
                  ? result.response.file_path.substring(1) 
                  : result.response.file_path;
                const fileUrl = `${process.env.REACT_APP_API_URL || 'http://localhost:8000'}/${cleanPath}`;
                
                // Get file info
                const fileExt = result.name.split('.').pop().toUpperCase();
                // Try to get file size from response, or calculate from original file if available
                let fileSize = 'Unknown';
                if (result.response.file_size) {
                  fileSize = (result.response.file_size / 1024).toFixed(1);
                } else if (result.originalSize) {
                  fileSize = (result.originalSize / 1024).toFixed(1);
                }
                
                return `<span class="file-attachment-card" contenteditable="false" data-filename="${result.name}" data-fileurl="${fileUrl}" data-fileext="${fileExt}" data-filesize="${fileSize}"><a href="${fileUrl}" download="${result.name}" target="_blank"><span class="file-icon"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg></span><span class="file-info"><span class="file-name">${result.name}</span><span class="file-ext">${fileExt}</span><span class="file-size">${fileSize} KB</span></span></a><button class="file-delete-btn" type="button" title="Remove file"><svg fill="none" stroke="currentColor" viewBox="0 0 24 24" width="12" height="12"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg></button></span>`;
              }).join('');
              
              // Append file links to the existing HTML
              const updatedHtmlWithFiles = updatedHtml + fileLinksHtml;
              
              // Update section with HTML including file links
              await portfolioApi.updateSection(newSectionId, {
                section_texts: [{ language_id: 1, text: updatedHtmlWithFiles }]
              }, authToken);
              
              console.log(`[FILE UPLOAD] Added ${uploadResults.length} elegant file link(s) to section HTML`);
            } catch (updateErr) {
              console.error('[FILE UPLOAD] Failed to update section HTML with file links:', updateErr);
            }
          }
          
          // Show results
          if (uploadErrors.length > 0) {
            const errorMessage = `Section created, but ${uploadErrors.length} file(s) failed to upload: ${uploadErrors.map(e => e.name).join(', ')}`;
            setError(errorMessage);
            console.warn('File upload errors:', uploadErrors);
          } else {
            console.log(`All ${uploadResults.length} file(s) uploaded successfully`);
          }
        }
      }
      onSuccess();
    } catch (err) {
      console.error(`Error ${isEditing ? 'updating' : 'creating'} section:`, err);
      setError(err.message || `Failed to ${isEditing ? 'update' : 'create'} section`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-4">
      <div className="bg-gray-900 border border-[#14C800]/30 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">
            {isEditing ? 'Edit Section' : 'Add New Section'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            disabled={loading}
          >
            <FaTimes size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded text-red-200 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section Code */}
          <div>
            <label className="block mb-2 font-semibold text-white text-sm uppercase tracking-wide">
              Section Code *
            </label>
            <input
              type="text"
              value={formData.code}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, code: e.target.value }))
              }
              className="w-full px-4 py-3 bg-white/5 border border-[#14C800]/50 rounded-none focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 text-white placeholder-white/50"
              placeholder="e.g., technical-architecture"
              disabled={loading || isEditing}
            />
            {isEditing && (
              <p className="text-xs text-gray-500 mt-1">Section code cannot be changed after creation</p>
            )}
          </div>

          {/* Section Content - Rich Text Editor */}
          <div>
            <label className="block mb-4 font-semibold text-white text-sm uppercase tracking-wide">
              Section Content *
            </label>
            <RichTextSectionEditor
              initialContent={formData.section_texts[0].text}
              initialImages={images}
              initialAttachments={attachments}
              sectionId={isEditing ? section.id : null}
              authToken={authToken}
              onChange={(html) => {
                console.log('[ProjectSectionManager] Received HTML from editor:', html.substring(0, 100) + '...');
                setFormData((prev) => ({
                  ...prev,
                  section_texts: [{ language_id: 1, text: html }],
                }));
              }}
              onImagesChange={setImages}
              onAttachmentsChange={setAttachments}
              onPendingFilesChange={setPendingFiles}
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">
              Use the rich text editor to format your content, add images inline, and attach files.
              {!isEditing && pendingFiles.length > 0 && ` ${pendingFiles.length} file(s) will be uploaded when section is saved.`}
            </p>
          </div>

          {/* Display Order */}
          <div>
            <label className="block mb-2 font-semibold text-white text-sm uppercase tracking-wide">
              Display Order
            </label>
            <input
              type="number"
              value={formData.display_order}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  display_order: parseInt(e.target.value) || 0,
                }))
              }
              className="w-full px-4 py-3 bg-white/5 border border-[#14C800]/50 rounded-none focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 text-white placeholder-white/50"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-1">Lower numbers appear first (0 = first)</p>
          </div>

          {/* Display Style Toggle */}
          <div>
            <label className="block mb-3 font-semibold text-white text-sm uppercase tracking-wide">
              Display Style
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, display_style: 'bordered' }))}
                className={`flex-1 px-4 py-3 rounded font-semibold transition-all duration-200 ${
                  formData.display_style === 'bordered'
                    ? 'bg-[#14C800]/20 border-2 border-[#14C800] text-[#14C800]'
                    : 'bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
                disabled={loading}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full h-12 border-2 border-current rounded bg-current/10"></div>
                  <span className="text-sm">With Border</span>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData((prev) => ({ ...prev, display_style: 'borderless' }))}
                className={`flex-1 px-4 py-3 rounded font-semibold transition-all duration-200 ${
                  formData.display_style === 'borderless'
                    ? 'bg-[#14C800]/20 border-2 border-[#14C800] text-[#14C800]'
                    : 'bg-gray-800/50 border border-gray-700/50 text-gray-400 hover:text-gray-300 hover:border-gray-600'
                }`}
                disabled={loading}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-full h-12 border-0 bg-transparent">
                    <div className="w-full h-full bg-current/10"></div>
                  </div>
                  <span className="text-sm">Borderless</span>
                </div>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Choose how this section appears: with a bordered box or seamlessly integrated into the page
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 pt-6 border-t border-gray-700/50">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 btn-primary flex items-center justify-center gap-2"
            >
              {loading ? (
                <>Saving...</>
              ) : isEditing ? (
                <><FaCheck /> Update Section</>
              ) : (
                <><FaPlus /> Create Section</>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 btn-flat"
            >
              {isEditing ? 'Close' : 'Cancel'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export { SectionEditorDialog };
export default ProjectSectionManager;
