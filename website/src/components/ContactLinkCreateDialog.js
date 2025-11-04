import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { FaXmark, FaCircleExclamation, FaPlus } from 'react-icons/fa6';
import portfolioApi from '../services/portfolioApi';
import { useEditMode } from '../context/EditModeContext';
import { getIconComponent, getIconOptions, getIconDisplayName, fallbackIconName } from '../utils/iconUtils';

const isLanguageEnabled = (language) => {
  if (!language) return false;
  if (Object.prototype.hasOwnProperty.call(language, 'is_enabled')) {
    return Boolean(language.is_enabled);
  }
  if (Object.prototype.hasOwnProperty.call(language, 'enabled')) {
    return Boolean(language.enabled);
  }
  return true;
};

const normalizeLanguages = (response) => {
  const candidates = (() => {
    if (!response) return [];
    if (Array.isArray(response.items)) return response.items;
    if (Array.isArray(response.results)) return response.results;
    if (Array.isArray(response.data?.items)) return response.data.items;
    if (Array.isArray(response.data)) return response.data;
    if (Array.isArray(response)) return response;
    return [];
  })();

  return candidates.filter(isLanguageEnabled);
};

const normalizeCategories = (response) => {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response.items)) return response.items;
  if (Array.isArray(response.data)) return response.data;
  return [];
};

const ContactLinkCreateDialog = ({ isOpen, onClose, portfolioId, onCreated }) => {
  const { authToken, showNotification } = useEditMode();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [languages, setLanguages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [form, setForm] = useState({
    url: '',
    is_route: false,
    category_id: '',
    icon_name: '',
    texts: []
  });
  const [error, setError] = useState(null);

  const buildTextEntry = (language) => {
    if (!language) {
      return null;
    }
    return {
      language_id: language.id,
      code: language.code,
      label: language.name,
      name: ''
    };
  };

  const languageMap = useMemo(() => {
    const map = new Map();
    languages.forEach((lang) => {
      if (lang?.id != null) {
        map.set(lang.id, lang);
      }
    });
    return map;
  }, [languages]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === Number(form.category_id)) || null,
    [categories, form.category_id]
  );

  const iconValue = form.icon_name || selectedCategory?.icon_name || fallbackIconName;

  const iconOptions = useMemo(() => {
    const categoryIcons = categories.map((category) => category?.icon_name).filter(Boolean);
    return getIconOptions([...categoryIcons, iconValue]);
  }, [categories, iconValue]);

  const IconPreview = useMemo(() => getIconComponent(iconValue), [iconValue]);
  const iconLabel = getIconDisplayName(iconValue);

  const availableLanguages = useMemo(
    () =>
      languages.filter((lang) => !form.texts.some((text) => text.language_id === lang.id)),
    [languages, form.texts]
  );

  const loadMeta = useCallback(async () => {
    if (!isOpen || !portfolioId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [langResponse, categoryResponse] = await Promise.all([
        portfolioApi.getLanguages(authToken),
        portfolioApi.getLinkCategories(authToken)
      ]);
      const langs = normalizeLanguages(langResponse);
      const cats = normalizeCategories(categoryResponse);
      setLanguages(langs);
      setCategories(cats);
      const defaultLanguage = langs.find((lang) => lang.is_default) || langs[0] || null;
      const defaultCategoryId = cats[0]?.id || '';
      const defaultIcon =
        cats.find((category) => category.id === defaultCategoryId)?.icon_name || fallbackIconName;
      const initialText = buildTextEntry(defaultLanguage);
      setForm({
        url: '',
        is_route: false,
        category_id: defaultCategoryId,
        icon_name: defaultIcon,
        texts: initialText ? [initialText] : []
      });
    } catch (metaError) {
      console.error('Failed to load link metadata:', metaError);
      setError('Unable to load languages or categories. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, [isOpen, portfolioId, authToken]);

  useEffect(() => {
    if (isOpen) {
      loadMeta();
    }
  }, [isOpen, loadMeta]);

  const handleFieldChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleTextChange = (languageId, value) => {
    setForm((prev) => ({
      ...prev,
      texts: prev.texts.map((text) =>
        text.language_id === languageId ? { ...text, name: value } : text
      )
    }));
  };

  const handleCategoryChange = (categoryId) => {
    const numericCategoryId = Number(categoryId);
    const category = categories.find((cat) => cat.id === numericCategoryId);
    setForm((prev) => ({
      ...prev,
      category_id: categoryId,
      icon_name: category?.icon_name || prev.icon_name || fallbackIconName
    }));
  };

  const handleIconChange = (iconName) => {
    setForm((prev) => ({
      ...prev,
      icon_name: iconName || fallbackIconName
    }));
  };

  const handleLanguageChange = (currentLanguageId, nextLanguageId) => {
    const numericNext = Number(nextLanguageId);
    if (numericNext === currentLanguageId) {
      return;
    }

    if (form.texts.some((text) => text.language_id === numericNext)) {
      showNotification?.(
        'Language already added',
        'Each language can only be added once per link.',
        'warning'
      );
      return;
    }

    const language = languageMap.get(numericNext);
    if (!language) {
      showNotification?.(
        'Language unavailable',
        'The selected language is not enabled.',
        'error'
      );
      return;
    }

    const entry = buildTextEntry(language);

    setForm((prev) => ({
      ...prev,
      texts: prev.texts.map((text) =>
        text.language_id === currentLanguageId ? entry : text
      )
    }));
  };

  const handleAddLanguage = () => {
    let added = false;

    setForm((prev) => {
      const usedIds = prev.texts.map((text) => text.language_id);
      const nextLanguage = languages.find((lang) => !usedIds.includes(lang.id));
      if (!nextLanguage) {
        return prev;
      }

      const entry = buildTextEntry(nextLanguage);
      if (!entry) {
        return prev;
      }

      added = true;

      return {
        ...prev,
        texts: [...prev.texts, entry]
      };
    });

    if (!added) {
      showNotification?.(
        'All languages added',
        'All enabled languages are already included for this link.',
        'info'
      );
    }
  };

  const handleRemoveLanguage = (languageId) => {
    let removed = false;

    setForm((prev) => {
      if (prev.texts.length <= 1) {
        return prev;
      }

      removed = true;

      return {
        ...prev,
        texts: prev.texts.filter((text) => text.language_id !== languageId)
      };
    });

    if (!removed) {
      showNotification?.(
        'Keep at least one language',
        'Each link needs at least one language entry.',
        'warning'
      );
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!portfolioId) return;

    if (!form.url.trim()) {
      setError('Please provide a valid URL.');
      return;
    }
    if (!form.category_id) {
      setError('Please select a category.');
      return;
    }

    const numericCategoryId = Number(form.category_id);
    const category = categories.find((cat) => cat.id === numericCategoryId);
    const desiredIconName = form.icon_name || category?.icon_name || fallbackIconName;

    const textsPayload = form.texts
      .filter((text) => text.name && text.name.trim())
      .map((text) => ({
        language_id: Number(text.language_id),
        name: text.name.trim()
      }));

    setIsSaving(true);
    setError(null);
    try {
      if (category && desiredIconName !== category.icon_name) {
        await portfolioApi.updateLinkCategory(category.id, { icon_name: desiredIconName }, authToken);
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === category.id ? { ...cat, icon_name: desiredIconName } : cat
          )
        );
      }

      await portfolioApi.createPortfolioLink(
        {
          portfolio_id: portfolioId,
          category_id: numericCategoryId,
          url: form.url.trim(),
          is_route: Boolean(form.is_route),
          is_active: true,
          order: 999,
          texts: textsPayload
        },
        authToken
      );
      showNotification?.('Link created', 'The new contact link was added.', 'success');
      onCreated?.();
      onClose?.();
    } catch (saveError) {
      console.error('Failed to create contact link:', saveError);
      setError('Failed to create the link. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-[#0c0f11] shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Add Contact Link</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
          >
            <FaXmark />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
              <FaCircleExclamation className="h-4 w-4" />
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
              <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
              Loading fields…
            </div>
          ) : (
            <>
              <div>
                <label className="block text-xs uppercase tracking-wide text-white/60">
                  Link URL / Route Path
                </label>
                <input
                  type={form.is_route ? "text" : "url"}
                  value={form.url}
                  onChange={(event) => handleFieldChange('url', event.target.value)}
                  placeholder={form.is_route ? "/contact or /en/projects" : "https://example.com/profile"}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#14C800]"
                  required
                />
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is-route-checkbox"
                    checked={form.is_route}
                    onChange={(event) => handleFieldChange('is_route', event.target.checked)}
                    className="h-4 w-4 rounded border-white/10 bg-black/30 text-[#14C800] focus:ring-2 focus:ring-[#14C800] focus:ring-offset-0"
                  />
                  <label htmlFor="is-route-checkbox" className="text-xs text-white/70">
                    This is an internal route (e.g., /contact, /en/projects)
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-white/60">
                  Link Category
                </label>
                <select
                  value={form.category_id}
                  onChange={(event) => handleCategoryChange(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#14C800]"
                  required
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.texts?.[0]?.name || category.name || category.code}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wide text-white/60">
                  Icon
                </label>
                <div className="mt-1 flex items-center gap-3">
                  <select
                    value={iconValue}
                    onChange={(event) => handleIconChange(event.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#14C800]"
                  >
                    {iconOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-lg text-white">
                    <IconPreview />
                  </span>
                </div>
                <p className="mt-1 text-xs text-white/50">Showing {iconLabel} icon</p>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs uppercase tracking-wide text-white/60">
                    Link Names
                  </span>
                  <button
                    type="button"
                    onClick={handleAddLanguage}
                    className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:border-white/20 hover:bg-white/15 disabled:opacity-40"
                    disabled={availableLanguages.length === 0}
                  >
                    <FaPlus className="h-3 w-3" />
                    Add language
                  </button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {form.texts.map((text, index) => {
                    const languageOptions = languages.filter(
                      (lang) =>
                        lang.id === text.language_id ||
                        !form.texts.some((entry) => entry.language_id === lang.id)
                    );
                    const languageMeta = languageMap.get(text.language_id);
                    return (
                      <div
                        key={`${text.language_id}-${index}`}
                        className="rounded-lg border border-white/10 bg-black/30 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <label className="text-xs uppercase tracking-wide text-white/60">
                            Language
                          </label>
                          {form.texts.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLanguage(text.language_id)}
                              className="text-xs font-medium text-red-300 transition hover:text-red-100"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <select
                          value={text.language_id}
                          onChange={(event) =>
                            handleLanguageChange(text.language_id, event.target.value)
                          }
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#14C800]"
                        >
                          {languageOptions.map((lang) => (
                            <option key={lang.id} value={lang.id}>
                              {lang.name} ({lang.code?.toUpperCase()})
                            </option>
                          ))}
                        </select>
                        <label className="mt-3 block text-xs uppercase tracking-wide text-white/60">
                          Link Name
                        </label>
                        <input
                          type="text"
                          value={text.name}
                          onChange={(event) =>
                            handleTextChange(text.language_id, event.target.value)
                          }
                          placeholder={`Display name (${languageMeta?.code?.toUpperCase() || 'LANG'})`}
                          className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#14C800]"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-white/20 hover:bg-white/10"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg border border-[#14C800]/50 bg-[#14C800]/20 px-4 py-2 text-sm font-medium text-[#14C800] transition hover:bg-[#14C800]/30 disabled:opacity-50"
              disabled={isSaving || isLoading || !portfolioId}
            >
              {isSaving ? 'Saving…' : 'Create Link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ContactLinkCreateDialog;
