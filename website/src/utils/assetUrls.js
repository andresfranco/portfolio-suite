const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export const resolveAssetUrl = (value) => {
  if (!value || typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim().replace(/\\/g, '/');
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }

  const uploadsMarkers = ['/uploads/', 'uploads/', '/static/uploads/', 'static/uploads/'];
  for (const marker of uploadsMarkers) {
    const markerIndex = trimmed.indexOf(marker);
    if (markerIndex >= 0) {
      const suffix = trimmed.slice(markerIndex + marker.length);
      return `${API_BASE_URL}/uploads/${suffix.replace(/^\/+/, '')}`;
    }
  }

  if (trimmed.startsWith('/')) {
    return `${API_BASE_URL}${trimmed}`;
  }

  return `${API_BASE_URL}/uploads/${trimmed.replace(/^\/+/, '')}`;
};

export const resolveImageUrl = (image) => {
  if (!image) {
    return null;
  }

  return resolveAssetUrl(image.image_url || image.image_path || image.file_path);
};
