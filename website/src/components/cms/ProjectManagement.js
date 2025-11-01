import React, { useState, useEffect } from 'react';
import { useEditMode } from '../../context/EditModeContext';
import { usePortfolio } from '../../context/PortfolioContext';
import { LanguageContext } from '../../context/LanguageContext';
import { portfolioApi } from '../../services/portfolioApi';

/**
 * ProjectManagement Component
 * Provides create, edit, and delete functionality for projects in edit mode
 */
export const ProjectManagement = () => {
  const { isEditMode, authToken, showNotification } = useEditMode();
  const { refreshPortfolio } = usePortfolio();
  const { language } = React.useContext(LanguageContext);
  
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Don't render anything if not in edit mode
  if (!isEditMode) {
    return null;
  }

  const handleCreateProject = () => {
    setShowCreateDialog(true);
  };

  return (
    <>
      {/* Create Project Button */}
      <div className="mb-6 flex justify-end">
        <button
          onClick={handleCreateProject}
          className="btn-flat btn-flat-lg flex items-center gap-2 font-semibold text-white"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create New Project
        </button>
      </div>

      {/* Project Management Dialogs */}
      {showCreateDialog && (
        <ProjectFormDialog
          mode="create"
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => {
            setShowCreateDialog(false);
            refreshPortfolio();
            showNotification('Success', 'Project created successfully', 'success');
          }}
          authToken={authToken}
          language={language}
        />
      )}
    </>
  );
};

/**
 * ProjectFormDialog Component
 * Dialog for creating or editing projects
 */
export const ProjectFormDialog = ({ mode = 'create', project = null, onClose, onSuccess, authToken, language }) => {
  const { portfolio } = usePortfolio();
  const [formData, setFormData] = useState({
    repository_url: '',
    website_url: '',
    project_date: '',
    project_texts: [{ language_id: 1, name: '', description: '' }],
    categories: [],
    skills: []
  });
  const [languages, setLanguages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [skills, setSkills] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingData, setLoadingData] = useState(true);

  // Load form data (languages, categories, skills) on mount
  useEffect(() => {
    const loadFormData = async () => {
      setLoadingData(true);
      try {
        const [langsResponse, catsResponse, skillsResponse] = await Promise.all([
          portfolioApi.getLanguages(authToken),
          portfolioApi.getCategories(authToken),
          portfolioApi.getSkills(authToken)
        ]);

        const langsList = langsResponse.data?.items || langsResponse.items || [];
        setLanguages(langsList);

        const catsList = catsResponse.data?.items || catsResponse.items || [];
        // Filter for project categories (PROJ type)
        const projectCategories = catsList.filter(cat => cat.type_code === 'PROJ');
        setCategories(projectCategories);

        const skillsList = skillsResponse.data?.items || skillsResponse.items || [];
        setSkills(skillsList);

        // Initialize form data if editing
        if (mode === 'edit' && project) {
          setFormData({
            repository_url: project.repository_url || '',
            website_url: project.website_url || '',
            project_date: project.project_date || '',
            project_texts: project.project_texts?.map(text => ({
              language_id: text.language_id,
              name: text.name || '',
              description: text.description || ''
            })) || [{ language_id: langsList[0]?.id || 1, name: '', description: '' }],
            categories: project.categories?.map(cat => cat.id) || [],
            skills: project.skills?.map(skill => skill.id) || []
          });
        } else {
          // Set default language for new project
          const defaultLang = langsList.find(l => l.is_default) || langsList[0];
          if (defaultLang) {
            setFormData(prev => ({
              ...prev,
              project_texts: [{ language_id: defaultLang.id, name: '', description: '' }]
            }));
          }
        }
      } catch (err) {
        console.error('Error loading form data:', err);
        setError('Failed to load form data. Please try again.');
      } finally {
        setLoadingData(false);
      }
    };

    loadFormData();
  }, [authToken, mode, project]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      // Validate
      if (!formData.project_texts.some(text => text.name.trim())) {
        setError('At least one project name is required');
        setIsLoading(false);
        return;
      }

      if (mode === 'create') {
        // Create the project
        const createdProject = await portfolioApi.createProject(formData, authToken);
        console.log('Project created:', createdProject);

        // Associate the project with the current portfolio
        if (portfolio && portfolio.id && createdProject && createdProject.id) {
          console.log(`Associating project ${createdProject.id} with portfolio ${portfolio.id}`);
          try {
            await portfolioApi.addProjectToPortfolio(portfolio.id, createdProject.id, authToken);
            console.log('Project successfully associated with portfolio');
          } catch (associationError) {
            console.error('Error associating project with portfolio:', associationError);
            // Show a warning but don't fail the entire operation
            setError(`Project created but failed to associate with portfolio: ${associationError.message}`);
          }
        } else {
          console.warn('Portfolio ID or created project ID not available for association');
        }
      } else {
        await portfolioApi.updateProject(project.id, formData, authToken);
      }

      onSuccess();
    } catch (err) {
      console.error(`Error ${mode}ing project:`, err);
      setError(err.message || `Failed to ${mode} project`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTextChange = (languageId, field, value) => {
    setFormData(prev => ({
      ...prev,
      project_texts: prev.project_texts.map(text =>
        text.language_id === languageId ? { ...text, [field]: value } : text
      )
    }));
  };

  const addLanguage = () => {
    const usedLanguageIds = formData.project_texts.map(text => text.language_id);
    const availableLanguage = languages.find(lang => !usedLanguageIds.includes(lang.id));
    
    if (availableLanguage) {
      setFormData(prev => ({
        ...prev,
        project_texts: [...prev.project_texts, { 
          language_id: availableLanguage.id, 
          name: '', 
          description: '' 
        }]
      }));
    }
  };

  const removeLanguage = (languageId) => {
    if (formData.project_texts.length > 1) {
      setFormData(prev => ({
        ...prev,
        project_texts: prev.project_texts.filter(text => text.language_id !== languageId)
      }));
    }
  };

  const toggleCategory = (categoryId) => {
    setFormData(prev => ({
      ...prev,
      categories: prev.categories.includes(categoryId)
        ? prev.categories.filter(id => id !== categoryId)
        : [...prev.categories, categoryId]
    }));
  };

  const toggleSkill = (skillId) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.includes(skillId)
        ? prev.skills.filter(id => id !== skillId)
        : [...prev.skills, skillId]
    }));
  };

  const getLanguageName = (languageId) => {
    return languages.find(lang => lang.id === languageId)?.name || `Language ${languageId}`;
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return `Category ${categoryId}`;
    
    // Try to get name from category_texts for current language
    const defaultLang = languages.find(l => l.is_default);
    if (defaultLang && category.category_texts?.length > 0) {
      const text = category.category_texts.find(t => t.language_id === defaultLang.id);
      if (text?.name) return text.name;
    }
    
    return category.code || `Category ${categoryId}`;
  };

  const getSkillName = (skillId) => {
    const skill = skills.find(s => s.id === skillId);
    if (!skill) return `Skill ${skillId}`;
    
    // Try to get name from skill_texts for current language
    const defaultLang = languages.find(l => l.is_default);
    if (defaultLang && skill.skill_texts?.length > 0) {
      const text = skill.skill_texts.find(t => t.language_id === defaultLang.id);
      if (text?.name) return text.name;
    }
    
    return skill.type || `Skill ${skillId}`;
  };

  if (loadingData) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
    <div className="bg-[#03060a] border border-white/10 rounded-xl shadow-[0_20px_45px_rgba(10,15,30,0.55)] w-full max-w-4xl mx-4">
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#14C800]"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80] overflow-y-auto p-4">
      <div className="bg-[#03060a] border border-white/10 rounded-none shadow-[0_20px_45px_rgba(10,15,30,0.55)] w-full max-w-4xl mx-4 my-8 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <svg className="w-7 h-7 text-[#14C800]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mode === 'create' ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              )}
            </svg>
            {mode === 'create' ? 'Create New Project' : 'Edit Project'}
          </h2>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 bg-[#03060a]">

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-500/10 border border-red-500/40 text-red-300 px-4 py-3 rounded-none">
              {error}
            </div>
          )}

          {/* Basic Information */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Basic Information</h3>

            <div>
              <label className="block mb-2 font-semibold text-white text-sm uppercase tracking-wide">
                Repository URL
              </label>
              <input
                type="url"
                value={formData.repository_url}
                onChange={(e) => handleInputChange('repository_url', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-[#14C800]/50 rounded-none focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 text-white placeholder-white/50"
                placeholder="https://github.com/username/repo"
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold text-white text-sm uppercase tracking-wide">
                Website URL
              </label>
              <input
                type="url"
                value={formData.website_url}
                onChange={(e) => handleInputChange('website_url', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-[#14C800]/50 rounded-none focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 text-white placeholder-white/50"
                placeholder="https://myproject.com"
              />
            </div>

            <div>
              <label className="block mb-2 font-semibold text-white text-sm uppercase tracking-wide">
                Project Date
              </label>
              <input
                type="date"
                value={formData.project_date}
                onChange={(e) => handleInputChange('project_date', e.target.value)}
                className="w-full px-4 py-3 bg-white/5 border border-[#14C800]/50 rounded-none focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 text-white placeholder-white/50"
              />
            </div>
          </div>

          {/* Language Content */}
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold text-white">Content</h3>
              {languages.length > formData.project_texts.length && (
                <button
                  type="button"
                  onClick={addLanguage}
                  className="px-3 py-1 btn-flat btn-flat-sm text-white rounded text-sm hover:text-white"
                >
                  + Add Language
                </button>
              )}
            </div>

            {formData.project_texts.map((text, index) => (
              <div key={text.language_id} className="border border-white/10 rounded-none p-4 space-y-3 bg-white/5">
                <div className="flex justify-between items-center">
                  <h4 className="font-medium text-white">
                    {getLanguageName(text.language_id)}
                  </h4>
                  {formData.project_texts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLanguage(text.language_id)}
                      className="text-red-400 hover:text-red-300 text-sm"
                    >
                      Remove
                    </button>
                  )}
                </div>

                <div>
                  <label className="block mb-2 font-semibold text-white text-sm uppercase tracking-wide">
                    Project Name *
                  </label>
                  <input
                    type="text"
                    value={text.name}
                    onChange={(e) => handleTextChange(text.language_id, 'name', e.target.value)}
                    className="w-full px-4 py-3 bg-white/5 border border-[#14C800]/50 rounded-none focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 text-white placeholder-white/50"
                    placeholder="Enter project name"
                  />
                </div>

                <div>
                  <label className="block mb-2 font-semibold text-white text-sm uppercase tracking-wide">
                    Description
                  </label>
                  <textarea
                    value={text.description}
                    onChange={(e) => handleTextChange(text.language_id, 'description', e.target.value)}
                    rows="4"
                    className="w-full px-4 py-3 bg-white/5 border border-[#14C800]/50 rounded-none focus:outline-none focus:ring-2 focus:ring-[#14C800]/60 resize-y text-white placeholder-white/50"
                    placeholder="Enter project description"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Categories</h3>
              <div className="flex flex-wrap gap-2">
                {categories.map(category => (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className={`btn-flat btn-flat-sm ${formData.categories.includes(category.id) ? 'btn-flat-active font-semibold' : ''}`}
                  >
                    {getCategoryName(category.id)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Skills */}
          {skills.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-white">Skills</h3>
              <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto">
                {skills.map(skill => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => toggleSkill(skill.id)}
                    className={`btn-flat btn-flat-sm text-sm ${formData.skills.includes(skill.id) ? 'btn-flat-active font-semibold' : ''}`}
                  >
                    {getSkillName(skill.id)}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-white/10">
            <button
              type="submit"
              disabled={isLoading}
              className="btn-flat btn-flat-sm flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {mode === 'create' ? 'Create Project' : 'Save Changes'}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-flat btn-flat-sm"
            >
              Cancel
            </button>
          </div>
        </form>
        </div>
      </div>
    </div>
  );
};

/**
 * ProjectActionButtons Component
 * Edit and Delete buttons for individual projects in edit mode
 */
export const ProjectActionButtons = ({ project, onEdit, onDelete }) => {
  const { isEditMode } = useEditMode();

  if (!isEditMode) {
    return null;
  }

  return (
    <div className="absolute top-2 right-2 flex gap-2 z-10" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onEdit(project);
        }}
        className="btn-flat btn-flat-sm"
        title="Edit Project"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
        </svg>
      </button>
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDelete(project);
        }}
        className="btn-flat btn-flat-sm text-red-300 hover:text-red-200"
        title="Delete Project"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  );
};

/**
 * ProjectDeleteDialog Component
 * Confirmation dialog for deleting a project
 */
export const ProjectDeleteDialog = ({ project, onClose, onSuccess, authToken }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState('');
  const { getProjectText } = usePortfolio();

  const handleDelete = async () => {
    setIsDeleting(true);
    setError('');

    try {
      await portfolioApi.deleteProject(project.id, authToken);
      onSuccess();
    } catch (err) {
      console.error('Error deleting project:', err);
      setError(err.message || 'Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  const projectText = getProjectText(project);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[80]">
      <div className="bg-[#03060a] rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-white mb-4">Delete Project?</h2>
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/40 text-red-300 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="bg-white/5 border border-red-500/40 rounded-lg p-4 mb-6">
          <p className="text-white/80 mb-2">
            Are you sure you want to delete <strong>{projectText.name || 'this project'}</strong>?
          </p>
          <p className="text-sm text-red-600">
            This action cannot be undone. All project data, images, and attachments will be permanently deleted.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn-flat btn-flat-lg flex-1 font-semibold text-red-200 hover:text-red-100 disabled:cursor-not-allowed"
          >
            {isDeleting ? 'Deleting...' : 'Delete Project'}
          </button>
          <button
            onClick={onClose}
            disabled={isDeleting}
            className="btn-flat btn-flat-lg font-semibold"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectManagement;
