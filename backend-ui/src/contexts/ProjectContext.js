import React, { createContext, useContext, useState, useCallback } from 'react';
import { projectsApi, api } from '../services/api';
import { useAuthorization } from './AuthorizationContext';

// Create context
const ProjectContext = createContext();

export function ProjectProvider({ children }) {
  const { hasPermission } = useAuthorization();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    name: '',
    category_id: [],
    language_id: []
  });

  const fetchProjects = useCallback(async (params = {}) => {
    // Check permission before making API call
    if (!hasPermission('VIEW_PROJECTS')) {
      const errorMessage = 'You do not have permission to view projects';
      setError(errorMessage);
      return { items: [], total: 0 };
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('ProjectContext - fetchProjects called with raw params:', params);
      
      const requestParams = {
        page: params.page || pagination.page,
        page_size: params.pageSize || pagination.pageSize,
        include_full_details: true
      };

      // Handle name filter separately
      if (params.name) {
        console.log('ProjectContext - Adding name_filter:', params.name);
        requestParams.name_filter = params.name;
      }

      // Convert filter arrays to backend format
      const filterFields = [];
      const filterValues = [];
      const filterOperators = [];

      // Handle category_id filters
      if (Array.isArray(params.category_id) && params.category_id.length > 0) {
        console.log('ProjectContext - Processing category_id filters:', params.category_id);
        params.category_id.forEach(id => {
          filterFields.push('category_id');
          filterValues.push(id.toString());
          filterOperators.push('equals');
        });
      }

      // Handle skill_id filters
      if (Array.isArray(params.skill_id) && params.skill_id.length > 0) {
        console.log('ProjectContext - Processing skill_id filters:', params.skill_id);
        params.skill_id.forEach(id => {
          filterFields.push('skill_id');
          filterValues.push(id.toString());
          filterOperators.push('equals');
        });
      }

      // Handle language_id filters
      if (Array.isArray(params.language_id) && params.language_id.length > 0) {
        console.log('ProjectContext - Processing language_id filters:', params.language_id);
        params.language_id.forEach(id => {
          filterFields.push('language_id');
          filterValues.push(id.toString());
          filterOperators.push('equals');
        });
      }

      // Add filter arrays to request if we have any filters
      if (filterFields.length > 0) {
        requestParams.filter_field = filterFields;
        requestParams.filter_value = filterValues;
        requestParams.filter_operator = filterOperators;
        console.log('ProjectContext - Adding filter arrays:', {
          filter_field: filterFields,
          filter_value: filterValues,
          filter_operator: filterOperators
        });
      }

      // Add other parameters (like sort)
      Object.keys(params).forEach(key => {
        if (!['page', 'pageSize', 'name', 'category_id', 'skill_id', 'language_id'].includes(key)) {
          requestParams[key] = params[key];
        }
      });

      console.log('ProjectContext - Final request params being sent to API:', requestParams);
      
      // For filter arrays, we need to manually construct the URL to avoid axios bracket notation
      let customUrl = '/api/projects/';
      const urlParams = new URLSearchParams();
      
      // Add basic parameters
      Object.keys(requestParams).forEach(key => {
        if (key !== 'filter_field' && key !== 'filter_value' && key !== 'filter_operator') {
          urlParams.append(key, requestParams[key]);
        }
      });
      
      // Manually add filter arrays without brackets (FastAPI expects repeated params)
      if (requestParams.filter_field && requestParams.filter_value && requestParams.filter_operator) {
        for (let i = 0; i < requestParams.filter_field.length; i++) {
          urlParams.append('filter_field', requestParams.filter_field[i]);
          urlParams.append('filter_value', requestParams.filter_value[i]);
          urlParams.append('filter_operator', requestParams.filter_operator[i]);
        }
      }
      
      const finalUrl = `${customUrl}?${urlParams.toString()}`;
      console.log('ProjectContext - Final URL being requested:', finalUrl);
      
      const response = await api.get(finalUrl);
      
      console.log('ProjectContext - API response received:', {
        itemsCount: response.data.items?.length || 0,
        total: response.data.total || 0,
        page: response.data.page || 1
      });
      
      setProjects(response.data.items || []);
      setPagination({
        page: response.data.page || 1,
        pageSize: response.data.page_size || 10,
        total: response.data.total || 0
      });
      
      console.log('ProjectContext - Projects fetched successfully:', {
        count: response.data.items?.length || 0,
        total: response.data.total || 0
      });
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to fetch projects';
      setError(errorMessage);
      console.error('ProjectContext - Error fetching projects:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.pageSize]);

  const createProject = useCallback(async (projectData) => {
    // Check permission before making API call
    if (!hasPermission('CREATE_PROJECT')) {
      const errorMessage = 'You do not have permission to create projects';
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('ProjectContext - Creating project:', projectData);
      
      const response = await projectsApi.createProject(projectData);
      
      // Refresh the projects list
      await fetchProjects({ 
        page: pagination.page, 
        pageSize: pagination.pageSize,
        ...filters 
      });
      
      console.log('ProjectContext - Project created successfully:', response.data);
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to create project';
      setError(errorMessage);
      console.error('ProjectContext - Error creating project:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [hasPermission, fetchProjects, pagination, filters]);

  const updateProject = useCallback(async (id, projectData) => {
    // Check permission before making API call
    if (!hasPermission('EDIT_PROJECT')) {
      const errorMessage = 'You do not have permission to edit projects';
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('ProjectContext - Updating project:', { id, projectData });
      
      const response = await projectsApi.updateProject(id, projectData);
      
      // Refresh the projects list
      await fetchProjects({ 
        page: pagination.page, 
        pageSize: pagination.pageSize,
        ...filters 
      });
      
      console.log('ProjectContext - Project updated successfully:', response.data);
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update project';
      setError(errorMessage);
      console.error('ProjectContext - Error updating project:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [hasPermission, fetchProjects, pagination, filters]);

  const deleteProject = useCallback(async (id) => {
    // Check permission before making API call
    if (!hasPermission('DELETE_PROJECT')) {
      const errorMessage = 'You do not have permission to delete projects';
      setError(errorMessage);
      throw new Error(errorMessage);
    }

    try {
      setLoading(true);
      setError(null);
      
      console.log('ProjectContext - Deleting project:', id);
      
      const response = await projectsApi.deleteProject(id);
      
      // Refresh the projects list
      await fetchProjects({ 
        page: pagination.page, 
        pageSize: pagination.pageSize,
        ...filters 
      });
      
      console.log('ProjectContext - Project deleted successfully');
      
      return response.data;
    } catch (err) {
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to delete project';
      setError(errorMessage);
      console.error('ProjectContext - Error deleting project:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [hasPermission, fetchProjects, pagination, filters]);

  const updateFilters = useCallback((newFilters) => {
    console.log('ProjectContext - Updating filters:', newFilters);
    setFilters(newFilters);
  }, []);

  const updatePagination = useCallback((newPagination) => {
    console.log('ProjectContext - Updating pagination:', newPagination);
    setPagination(prev => ({ ...prev, ...newPagination }));
  }, []);

  return (
    <ProjectContext.Provider 
      value={{ 
        projects, 
        loading, 
        error, 
        pagination,
        filters,
        fetchProjects, 
        createProject, 
        updateProject, 
        deleteProject,
        updateFilters,
        updatePagination
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

// Custom hook to use the projects context
export function useProjects() {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProjects must be used within a ProjectProvider');
  }
  return context;
} 