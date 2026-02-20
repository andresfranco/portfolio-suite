import React, { useState, useEffect, useContext } from 'react';
import { useEditMode } from '../../context/EditModeContext';
import { LanguageContext } from '../../context/LanguageContext';
import { portfolioApi } from '../../services/portfolioApi';
import { FaTimes, FaSave, FaCalendar, FaFolder, FaCode } from 'react-icons/fa';

/**
 * ProjectMetadataEditor Component
 * Modal for editing project metadata (date, categories, skills)
 *
 * @param {boolean} isOpen - Modal open state
 * @param {Function} onClose - Close callback
 * @param {Object} project - Project object to edit
 * @param {Function} onUpdate - Update callback after successful save
 */
export const ProjectMetadataEditor = ({ isOpen, onClose, project, onUpdate }) => {
  const [projectDate, setProjectDate] = useState('');
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedSkills, setSelectedSkills] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableSkills, setAvailableSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const { authToken, showNotification } = useEditMode();
  const { language } = useContext(LanguageContext);

  /**
   * Initialize form data when modal opens
   */
  useEffect(() => {
    if (isOpen && project) {
      // Set project date (convert to YYYY-MM-DD format for input)
      if (project.project_date) {
        // Extract date string directly without timezone conversion
        // If it's already in YYYY-MM-DD format, use it as-is
        // Otherwise, format it properly
        let dateStr = project.project_date;
        if (dateStr.includes('T')) {
          // If it has time component, extract just the date part
          dateStr = dateStr.split('T')[0];
        }
        setProjectDate(dateStr);
      } else {
        setProjectDate('');
      }

      // Set selected categories
      setSelectedCategories(project.categories || []);

      // Set selected skills
      setSelectedSkills(project.skills || []);

      // Load available categories and skills
      loadCategoriesAndSkills();
    }
  }, [isOpen, project]);

  /**
   * Load available categories and skills from API
   */
  const loadCategoriesAndSkills = async () => {
    setLoading(true);
    setError(null);

    try {
      const [categoriesResponse, skillsResponse] = await Promise.all([
        portfolioApi.getCategories(authToken),
        portfolioApi.getSkills(authToken)
      ]);

      // Filter to only PROJ type categories
      const projectCategories = (categoriesResponse.items || []).filter(
        cat => cat.type_code === 'PROJ'
      );

      setAvailableCategories(projectCategories);
      setAvailableSkills(skillsResponse.items || []);
    } catch (err) {
      console.error('Failed to load categories and skills:', err);
      setError(err.message || 'Failed to load data');
      showNotification('Error', 'Failed to load categories and skills', 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle category selection toggle
   */
  const toggleCategory = (category) => {
    const isSelected = selectedCategories.some(cat => cat.id === category.id);

    if (isSelected) {
      setSelectedCategories(selectedCategories.filter(cat => cat.id !== category.id));
    } else {
      setSelectedCategories([...selectedCategories, category]);
    }
  };

  /**
   * Handle skill selection toggle
   */
  const toggleSkill = (skill) => {
    const isSelected = selectedSkills.some(s => s.id === skill.id);

    if (isSelected) {
      setSelectedSkills(selectedSkills.filter(s => s.id !== skill.id));
    } else {
      setSelectedSkills([...selectedSkills, skill]);
    }
  };

  /**
   * Helper to get category name in current language
   */
  const getCategoryName = (category) => {
    if (category.category_texts && category.category_texts.length > 0) {
      // Try to find text for current language
      const categoryText = category.category_texts.find(text =>
        text.language_code === language || text.language_id === (language === 'en' ? 1 : 2)
      );
      if (categoryText && categoryText.name) {
        return categoryText.name;
      }
      // Fallback to first available text
      return category.category_texts[0].name;
    }
    return category.code;
  };

  /**
   * Helper to get skill name in current language
   */
  const getSkillName = (skill) => {
    if (skill.skill_texts && skill.skill_texts.length > 0) {
      // Try to find text for current language
      const skillText = skill.skill_texts.find(text =>
        text.language_code === language || text.language_id === (language === 'en' ? 1 : 2)
      );
      if (skillText && skillText.name) {
        return skillText.name;
      }
      // Fallback to first available text
      return skill.skill_texts[0].name;
    }
    return skill.type || `Skill ${skill.id}`;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const updateData = {
        project_date: projectDate || null,
        categories: selectedCategories.map(cat => cat.id),
        skills: selectedSkills.map(skill => skill.id),
        // Keep existing data that we're not editing
        repository_url: project.repository_url,
        website_url: project.website_url,
        project_texts: project.project_texts
      };

      await portfolioApi.updateProject(project.id, updateData, authToken);

      showNotification('Success', 'Project metadata updated successfully', 'success');

      // Call the onUpdate callback to refresh the data
      if (onUpdate) {
        await onUpdate();
      }

      onClose();
    } catch (err) {
      console.error('Failed to update project metadata:', err);
      setError(err.message || 'Failed to update project');
      showNotification('Error', 'Failed to update project metadata', 'error');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle modal close
   */
  const handleClose = () => {
    if (!saving) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#03060a] border border-white/10 shadow-[0_20px_45px_rgba(10,15,30,0.55)] max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="text-white px-6 py-4 flex justify-between items-center border-b border-white/10">
          <h2 className="text-xl font-bold">Edit Project Metadata</h2>
          <button
            onClick={handleClose}
            disabled={saving}
            className="text-gray-500 hover:text-white/80 transition-colors"
          >
            <FaTimes size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-800"></div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                  {error}
                </div>
              )}

              {/* Project Date */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                  <FaCalendar className="text-gray-500" />
                  Project Date
                </label>
                <input
                  type="date"
                  value={projectDate}
                  onChange={(e) => setProjectDate(e.target.value)}
                  className="w-full px-3 py-2 border border-white/10 bg-white/10 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-[#14C800]"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Optional: Date associated with this project
                </p>
              </div>

              {/* Categories */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                  <FaFolder className="text-gray-500" />
                  Categories ({selectedCategories.length} selected)
                </label>
                <div className="border border-white/10 p-4 max-h-60 overflow-y-auto">
                  {availableCategories.length === 0 ? (
                    <p className="text-white/50 text-sm">No categories available</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {availableCategories.map(category => {
                        const isSelected = selectedCategories.some(cat => cat.id === category.id);
                        return (
                          <button
                            key={category.id}
                            type="button"
                            onClick={() => toggleCategory(category)}
                            className={`btn-flat btn-flat-sm ${isSelected ? 'btn-flat-active' : ''}`}>
                            {getCategoryName(category)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Skills */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-white/80 mb-2">
                  <FaCode className="text-gray-500" />
                  Skills ({selectedSkills.length} selected)
                </label>
                <div className="border border-white/10 p-4 max-h-60 overflow-y-auto">
                  {availableSkills.length === 0 ? (
                    <p className="text-white/50 text-sm">No skills available</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {availableSkills.map(skill => {
                        const isSelected = selectedSkills.some(s => s.id === skill.id);
                        return (
                          <button
                            key={skill.id}
                            type="button"
                            onClick={() => toggleSkill(skill)}
                            className={`btn-flat btn-flat-sm ${isSelected ? 'btn-flat-active' : ''}`}>
                            {getSkillName(skill)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="bg-transparent px-6 py-4 flex justify-end gap-3 border-t border-white/10">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="btn-flat btn-flat-lg"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || loading}
            className="btn-flat btn-flat-lg btn-flat-active flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <FaSave />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
