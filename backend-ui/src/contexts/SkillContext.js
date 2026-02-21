import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import skillApi from '../services/skillApi';
import { useAuthorization } from './AuthorizationContext';
import { logInfo, logError } from '../utils/logger';
import { getErrorMessage } from '../utils/errorUtils';

// Create context
const SkillContext = createContext(null);

// Custom hook for using the context
export const useSkill = () => {
  const context = useContext(SkillContext);
  if (!context) {
    throw new Error('useSkill must be used within a SkillProvider');
  }
  return context;
};

// Provider component
export const SkillProvider = ({ children }) => {
  const { hasPermission } = useAuthorization();
  
  // State for skills data
  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState([]);
  const [sortModel, setSortModel] = useState([]);

  // Fetch skills with current pagination and filters
  const fetchSkills = useCallback(async (page = 1, pageSize = 10, customFilters = null, customSortModel = null) => {
    if (!hasPermission('VIEW_SKILLS')) {
      setError('You do not have permission to view skills');
      return;
    }

    setLoading(true);
    setError(null);

    // Prepare parameters
    const params = {
      page: page,
      page_size: pageSize  // Convert pageSize to page_size for API
    };

    // Add sorting if available
    const sortModelToUse = customSortModel || sortModel;
    if (sortModelToUse && sortModelToUse.length > 0) {
      params.sort_field = sortModelToUse[0].field;
      params.sort_order = sortModelToUse[0].sort;
    }

    // Add filters if available
    const filtersToUse = customFilters !== null ? customFilters : filters;
    if (filtersToUse && filtersToUse.length > 0) {
      // filtersToUse is already in the correct array format from SkillFilters
      params.filters = filtersToUse.filter(f => 
        f.value !== undefined && 
        f.value !== null && 
        f.field && 
        f.operator &&
        (typeof f.value !== 'string' || f.value.trim() !== '') &&
        (!Array.isArray(f.value) || f.value.length > 0)
      );
    }

    try {
      logInfo('SkillContext', 'Fetching skills', params);
      const response = await skillApi.fetchSkills(params);
      
      // Add detailed logging to debug the response
      logInfo('SkillContext', 'Raw API response received:', response);
      logInfo('SkillContext', 'Response structure:', {
        hasItems: 'items' in response,
        hasTotal: 'total' in response,
        hasPage: 'page' in response,
        itemsType: typeof response.items,
        itemsLength: response.items?.length,
        totalValue: response.total,
        pageValue: response.page
      });
      
      setSkills(response.items || []);
      setPagination({
        page: response.page || 1,
        pageSize: response.pageSize || response.page_size || 10,
        total: response.total || 0
      });
      
      logInfo('SkillContext', 'Skills fetched successfully', { 
        count: response.items?.length || 0,
        total: response.total || 0,
        page: response.page || 1
      });
      
      return response;
    } catch (error) {
      if (error.response?.status === 403) {
        setError('You do not have permission to view skills');
      } else {
        const errorMessage = getErrorMessage(error);
        logError('SkillContext', 'Error fetching skills', error);
        setError(errorMessage);
      }
      return { items: [], total: 0 };
    } finally {
      setLoading(false);
    }
  }, [hasPermission, sortModel, filters]);

  // Create a new skill
  const createSkill = useCallback(async (skillData) => {
    if (!hasPermission('CREATE_SKILL')) {
      throw new Error('You do not have permission to create skills');
    }

    setLoading(true);
    setError(null);
    
    try {
      logInfo('SkillContext', 'Creating skill', { data: skillData });
      const response = await skillApi.createSkill(skillData);
      logInfo('SkillContext', 'Skill created successfully', { id: response.id });
      
      // Don't automatically refresh here - let the UI component handle it
      // await fetchSkills();
      
      return response;
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to create skills');
      }
      const errorMessage = getErrorMessage(error);
      logError('SkillContext', 'Error creating skill', error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  // Update an existing skill
  const updateSkill = useCallback(async (id, skillData) => {
    if (!hasPermission('EDIT_SKILL')) {
      throw new Error('You do not have permission to edit skills');
    }

    setLoading(true);
    setError(null);
    
    try {
      logInfo('SkillContext', 'Updating skill', { id, data: skillData });
      const response = await skillApi.updateSkill(id, skillData);
      logInfo('SkillContext', 'Skill updated successfully', { id });
      
      // Don't automatically refresh here - let the UI component handle it
      // await fetchSkills();
      
      return response;
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to edit skills');
      }
      const errorMessage = getErrorMessage(error);
      logError('SkillContext', 'Error updating skill', error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  // Delete a skill
  const deleteSkill = useCallback(async (id) => {
    if (!hasPermission('DELETE_SKILL')) {
      throw new Error('You do not have permission to delete skills');
    }

    setLoading(true);
    setError(null);
    
    try {
      logInfo('SkillContext', 'Deleting skill', { id });
      const response = await skillApi.deleteSkill(id);
      logInfo('SkillContext', 'Skill deleted successfully', { id });
      
      // Don't automatically refresh here - let the UI component handle it
      // await fetchSkills();
      
      return response;
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to delete skills');
      }
      const errorMessage = getErrorMessage(error);
      logError('SkillContext', 'Error deleting skill', error);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  // Fetch a single skill by ID
  const getSkillById = useCallback(async (id) => {
    if (!hasPermission('VIEW_SKILLS')) {
      throw new Error('You do not have permission to view skills');
    }

    setLoading(true);
    setError(null);
    
    try {
      logInfo('SkillContext', 'Fetching skill by ID', { id });
      const response = await skillApi.fetchSkillById(id);
      logInfo('SkillContext', 'Skill fetched successfully', { id });
      return response;
    } catch (error) {
      if (error.response?.status === 403) {
        setError('You do not have permission to view skills');
        throw new Error('You do not have permission to view skills');
      }
      const errorMessage = getErrorMessage(error);
      logError('SkillContext', 'Error fetching skill by ID', { id, error });
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [hasPermission]);

  // Check if a skill name exists for a language
  const checkNameExists = useCallback(async (name, languageId, excludeId = null) => {
    if (!hasPermission('VIEW_SKILLS')) {
      throw new Error('You do not have permission to check skill names');
    }

    try {
      logInfo('SkillContext', 'Checking if skill name exists', { name, languageId, excludeId });
      const response = await skillApi.checkSkillNameExists(name, languageId, excludeId);
      logInfo('SkillContext', 'Skill name check completed', { exists: response.exists });
      return response.exists;
    } catch (error) {
      if (error.response?.status === 403) {
        throw new Error('You do not have permission to check skill names');
      }
      const errorMessage = getErrorMessage(error);
      logError('SkillContext', 'Error checking skill name', error);
      setError(errorMessage);
      throw error;
    }
  }, [hasPermission]);

  // Update filters
  const updateFilters = useCallback((newFilters) => {
    logInfo('SkillContext', 'Updating filters', { newFilters });
    setFilters(Array.isArray(newFilters) ? newFilters : []);
    // Reset to first page when filters change
    setPagination(prev => ({ ...prev, page: 1 }));
  }, []);

  // Update pagination
  const updatePagination = useCallback((newPagination) => {
    logInfo('SkillContext', 'Updating pagination', { newPagination });
    setPagination(prev => ({ ...prev, ...newPagination }));
  }, []);

  // Update sort model
  const updateSortModel = useCallback((newSortModel) => {
    logInfo('SkillContext', 'Updating sort model', { newSortModel });
    setSortModel(newSortModel);
  }, []);

  // Context value
  const value = useMemo(() => ({
    skills,
    loading,
    error,
    pagination,
    filters,
    sortModel,
    fetchSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    getSkillById,
    checkNameExists,
    updateFilters,
    updatePagination,
    updateSortModel
  }), [
    skills,
    loading,
    error,
    pagination,
    filters,
    sortModel,
    fetchSkills,
    createSkill,
    updateSkill,
    deleteSkill,
    getSkillById,
    checkNameExists,
    updateFilters,
    updatePagination,
    updateSortModel
  ]);

  return (
    <SkillContext.Provider value={value}>
      {children}
    </SkillContext.Provider>
  );
};

export default SkillContext; 