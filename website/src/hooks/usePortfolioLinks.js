import { useCallback, useEffect, useMemo, useState } from 'react';
import { portfolioApi } from '../services/portfolioApi';

const normalizeLinkResponse = (response) => {
  if (Array.isArray(response)) {
    return response;
  }
  if (Array.isArray(response?.data)) {
    return response.data;
  }
  if (Array.isArray(response?.items)) {
    return response.items;
  }
  if (Array.isArray(response?.results)) {
    return response.results;
  }
  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }
  return [];
};

export const usePortfolioLinks = ({
  portfolioId,
  isEditMode = false,
  authToken = null,
  autoFetch = true
} = {}) => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const canFetch = useMemo(() => Boolean(portfolioId), [portfolioId]);

  const fetchLinks = useCallback(async () => {
    if (!canFetch) {
      setLinks([]);
      setLoading(false);
      return [];
    }

    setLoading(true);
    setError(null);

    try {
      const response = await portfolioApi.getPortfolioLinks(portfolioId, {
        activeOnly: !isEditMode,
        token: isEditMode ? authToken : null
      });
      const normalized = normalizeLinkResponse(response);
      setLinks(normalized);
      return normalized;
    } catch (err) {
      console.error('Failed to load portfolio links:', err);
      setLinks([]);
      setError(err);
      return [];
    } finally {
      setLoading(false);
    }
  }, [portfolioId, isEditMode, authToken, canFetch]);

  useEffect(() => {
    if (autoFetch) {
      fetchLinks();
    }
  }, [fetchLinks, autoFetch]);

  return {
    links,
    loading,
    error,
    refresh: fetchLinks,
    setLinks
  };
};

export default usePortfolioLinks;
