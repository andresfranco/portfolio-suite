import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { FaGripVertical, FaPlus, FaCircleExclamation, FaCircleCheck } from 'react-icons/fa6';
import { useEditMode } from '../context/EditModeContext';
import portfolioApi from '../services/portfolioApi';
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

const ContactLinksEditor = forwardRef(({ portfolioId, links = [], onRefresh }, ref) => {
  const { authToken, showNotification } = useEditMode();
  const [languages, setLanguages] = useState([]);
  const [categories, setCategories] = useState([]);
  const [isMetaLoading, setIsMetaLoading] = useState(false);
  const [activeForms, setActiveForms] = useState([]);
  const [inactiveLinks, setInactiveLinks] = useState([]);
  const [orderSaving, setOrderSaving] = useState(false);
  const [newLinkCounter, setNewLinkCounter] = useState(0);

  const languageMap = useMemo(() => {
    const map = new Map();
    languages.forEach((lang) => {
      if (lang?.id != null) {
        map.set(lang.id, lang);
      }
    });
    return map;
  }, [languages]);

  const defaultLanguage = useMemo(
    () => languages.find((lang) => lang.is_default) || languages[0] || null,
    [languages]
  );

  const iconOptions = useMemo(() => {
    const categoryIcons = categories.map((category) => category?.icon_name).filter(Boolean);
    const formIcons = activeForms.map((form) => form?.icon_name).filter(Boolean);
    return getIconOptions([...categoryIcons, ...formIcons]);
  }, [categories, activeForms]);

  const buildTextEntry = (language, existingText = null) => {
    if (!language) {
      return null;
    }
    return {
      language_id: language.id,
      code: language.code,
      label: language.name,
      name: existingText?.name || ''
    };
  };

  const canEdit = Boolean(authToken && portfolioId);

  /**
   * Fetch reference data (languages, categories)
   */
  const loadMeta = useCallback(async () => {
    if (!canEdit) {
      return;
    }

    setIsMetaLoading(true);
    try {
      const [langResponse, categoryResponse] = await Promise.all([
        portfolioApi.getLanguages(authToken),
        portfolioApi.getLinkCategories(authToken)
      ]);
      setLanguages(normalizeLanguages(langResponse));
      setCategories(normalizeCategories(categoryResponse));
    } catch (error) {
      console.error('Failed to load contact link metadata:', error);
      showNotification?.(
        'Unable to load link metadata',
        'We could not load languages or categories. Try refreshing the page.',
        'error'
      );
    } finally {
      setIsMetaLoading(false);
    }
  }, [authToken, canEdit, showNotification]);

  useEffect(() => {
    if (canEdit) {
      loadMeta();
    }
  }, [canEdit, loadMeta]);

  const sortLinks = useCallback((items) => {
    return [...items].sort((a, b) => {
      const orderA = a.order ?? a.display_order ?? 0;
      const orderB = b.order ?? b.display_order ?? 0;
      return orderA - orderB;
    });
  }, []);

  /**
   * Prepare editable forms whenever links or languages change
   */
  useEffect(() => {
    if (!languages.length) {
      setActiveForms([]);
      setInactiveLinks(sortLinks((links || []).filter((link) => !link.is_active)));
      return;
    }

    const active = [];
    const inactive = [];

    (links || []).forEach((link) => {
      if (link.is_active) {
        active.push(link);
      } else {
        inactive.push(link);
      }
    });

    const mapLinkToForm = (link) => {
      const rawTexts = link.texts || link.link_texts || [];
      const mappedTexts = rawTexts
        .map((text) => {
          const language = languageMap.get(text.language_id);
          return buildTextEntry(language, text);
        })
        .filter(Boolean);

      if (!mappedTexts.length) {
        const fallbackLanguage = defaultLanguage || languages[0];
        const fallbackEntry = buildTextEntry(fallbackLanguage);
        if (fallbackEntry) {
          mappedTexts.push(fallbackEntry);
        }
      }

      return {
        id: link.id,
        isNew: false,
        url: link.url || '',
        is_route: link.is_route || false,
        category_id: link.category_id || '',
        order: link.order ?? link.display_order ?? 0,
        icon_name: link.category?.icon_name || fallbackIconName,
        texts: mappedTexts,
        isSaving: false,
        error: null
      };
    };

    setActiveForms(sortLinks(active).map(mapLinkToForm));
    setInactiveLinks(sortLinks(inactive));
  }, [links, languages, sortLinks, languageMap, defaultLanguage]);

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination } = result;
    if (source.index === destination.index) return;

    const previousForms = activeForms;
    const reordered = Array.from(activeForms);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    const reorderedWithOrder = reordered.map((form, index) => ({
      ...form,
      order: index
    }));

    setActiveForms(reorderedWithOrder);

    const hasUnsaved = reorderedWithOrder.some((form) => form.isNew);
    if (hasUnsaved) {
      showNotification?.(
        'Save pending links',
        'Please save new links before saving the order.',
        'warning'
      );
      return;
    }

    if (!canEdit) return;

    setOrderSaving(true);
    try {
      const linkOrders = reorderedWithOrder.map((form, index) => ({
        id: form.id,
        order: index
      }));
      await portfolioApi.updatePortfolioLinksOrder(portfolioId, linkOrders, authToken);
      showNotification?.('Link order updated', 'The contact link order was saved.', 'success');
      onRefresh?.();
    } catch (error) {
      console.error('Failed to update contact link order:', error);
      showNotification?.(
        'Unable to update order',
        'We could not save the new link order. Please try again.',
        'error'
      );
      // Revert to previous state on failure
      setActiveForms(previousForms);
    } finally {
      setOrderSaving(false);
    }
  };

  const updateFormField = (formId, field, value) => {
    setActiveForms((prev) =>
      prev.map((form) =>
        form.id === formId
          ? {
              ...form,
              [field]: value,
              error: null
            }
          : form
      )
    );
  };

  const updateTextField = (formId, languageId, value) => {
    setActiveForms((prev) =>
      prev.map((form) =>
        form.id === formId
          ? {
              ...form,
              texts: form.texts.map((text) =>
                text.language_id === languageId
                  ? { ...text, name: value }
                  : text
              ),
              error: null
            }
          : form
      )
    );
  };

  const handleCategoryChange = (formId, categoryId) => {
    const numericCategoryId = Number(categoryId);
    const category = categories.find((cat) => cat.id === numericCategoryId);
    setActiveForms((prev) =>
      prev.map((form) =>
        form.id === formId
          ? {
              ...form,
              category_id: numericCategoryId,
              icon_name: category?.icon_name || form.icon_name || fallbackIconName,
              error: null
            }
          : form
      )
    );
  };

  const handleIconChange = (formId, iconName) => {
    setActiveForms((prev) =>
      prev.map((form) =>
        form.id === formId
          ? {
              ...form,
              icon_name: iconName || fallbackIconName,
              error: null
            }
          : form
      )
    );
  };

  const handleAddLanguage = (formId) => {
    let addedLanguage = false;

    setActiveForms((prev) =>
      prev.map((form) => {
        if (form.id !== formId) {
          return form;
        }

        const usedIds = form.texts.map((text) => text.language_id);
        const availableLanguage = languages.find((lang) => !usedIds.includes(lang.id));

        if (!availableLanguage) {
          return form;
        }

        const entry = buildTextEntry(availableLanguage);
        if (!entry) {
          return form;
        }

        addedLanguage = true;

        return {
          ...form,
          texts: [...form.texts, entry],
          error: null
        };
      })
    );

    if (!addedLanguage) {
      showNotification?.(
        'All languages added',
        'All enabled languages are already included for this link.',
        'info'
      );
    }
  };

  const handleRemoveLanguage = (formId, languageId) => {
    let removed = false;

    setActiveForms((prev) =>
      prev.map((form) => {
        if (form.id !== formId) {
          return form;
        }

        if (form.texts.length <= 1) {
          return form;
        }

        removed = true;

        return {
          ...form,
          texts: form.texts.filter((text) => text.language_id !== languageId),
          error: null
        };
      })
    );

    if (!removed) {
      showNotification?.(
        'Keep at least one language',
        'Each link needs at least one language entry.',
        'warning'
      );
    }
  };

  const handleTextLanguageChange = (formId, previousLanguageId, nextLanguageId) => {
    const numericNextLanguageId = Number(nextLanguageId);
    let duplicate = false;
    let missingLanguage = false;

    setActiveForms((prev) =>
      prev.map((form) => {
        if (form.id !== formId) {
          return form;
        }

        if (form.texts.some((text) => text.language_id === numericNextLanguageId)) {
          duplicate = true;
          return form;
        }

        const language = languageMap.get(numericNextLanguageId);

        if (!language) {
          missingLanguage = true;
          return form;
        }

        const entry = buildTextEntry(language);

        return {
          ...form,
          texts: form.texts.map((text) =>
            text.language_id === previousLanguageId
              ? entry
              : text
          ),
          error: null
        };
      })
    );

    if (duplicate) {
      showNotification?.(
        'Language already added',
        'Each language can only appear once per link.',
        'warning'
      );
    } else if (missingLanguage) {
      showNotification?.(
        'Language unavailable',
        'The selected language is not enabled for editing.',
        'error'
      );
    }
  };

  const setFormSavingState = (formId, isSaving, error = null) => {
    setActiveForms((prev) =>
      prev.map((form) =>
        form.id === formId
          ? {
              ...form,
              isSaving,
              error
            }
          : form
      )
    );
  };

  const handleSaveLink = async (formId) => {
    const form = activeForms.find((item) => item.id === formId);
    if (!form) return;

    if (!form.url.trim()) {
      setFormSavingState(formId, false, 'Please provide a valid URL.');
      return;
    }
    if (!form.category_id) {
      setFormSavingState(formId, false, 'Select a category for this link.');
      return;
    }

    if (!canEdit) {
      setFormSavingState(formId, false, 'Editing is not available.');
      return;
    }

    setFormSavingState(formId, true);

    const numericCategoryId = Number(form.category_id);
    const category = categories.find((cat) => cat.id === numericCategoryId);
    const desiredIconName = form.icon_name || category?.icon_name || fallbackIconName;

    const payload = {
      category_id: numericCategoryId,
      url: form.url.trim(),
      is_route: Boolean(form.is_route),
      is_active: true,
      order: form.order ?? 0
    };

    const textsPayload = form.texts
      .filter((text) => text.name && text.name.trim().length > 0)
      .map((text) => ({
        language_id: Number(text.language_id),
        name: text.name.trim()
      }));

    try {
      if (category && desiredIconName !== category.icon_name) {
        await portfolioApi.updateLinkCategory(category.id, { icon_name: desiredIconName }, authToken);
        setCategories((prev) =>
          prev.map((cat) =>
            cat.id === category.id ? { ...cat, icon_name: desiredIconName } : cat
          )
        );
      }

      if (form.isNew) {
        const createPayload = {
          ...payload,
          portfolio_id: portfolioId,
          texts: textsPayload
        };
        await portfolioApi.createPortfolioLink(createPayload, authToken);
        showNotification?.('Link created', 'The new contact link was added.', 'success');
      } else {
        await portfolioApi.updatePortfolioLink(form.id, payload, authToken);
        if (textsPayload.length > 0) {
          await Promise.all(
            textsPayload.map((text) =>
              portfolioApi.createPortfolioLinkText(form.id, text, authToken)
            )
          );
        }
        showNotification?.('Link updated', 'The contact link changes were saved.', 'success');
      }
      onRefresh?.();
    } catch (error) {
      console.error('Failed to save contact link:', error);
      showNotification?.(
        'Unable to save link',
        'We could not save the link changes. Please try again.',
        'error'
      );
      setFormSavingState(formId, false, 'Failed to save changes.');
    }
  };

  const handleDeactivateLink = async (formId) => {
    const form = activeForms.find((item) => item.id === formId);
    if (!form || form.isNew) {
      setActiveForms((prev) => prev.filter((item) => item.id !== formId));
      return;
    }

    if (!canEdit) return;

    setFormSavingState(formId, true);
    try {
      await portfolioApi.updatePortfolioLink(form.id, { is_active: false }, authToken);
      showNotification?.('Link removed', 'The link was removed from this section.', 'info');
      onRefresh?.();
    } catch (error) {
      console.error('Failed to deactivate contact link:', error);
      showNotification?.(
        'Unable to remove link',
        'We could not remove the link from this section.',
        'error'
      );
      setFormSavingState(formId, false, 'Failed to remove link.');
    }
  };

  const handleActivateExisting = async (link) => {
    if (!canEdit) return;
    try {
      await portfolioApi.updatePortfolioLink(
        link.id,
        {
          is_active: true,
          order: activeForms.length
        },
        authToken
      );
      showNotification?.('Link added', 'The link is now visible in this section.', 'success');
      onRefresh?.();
    } catch (error) {
      console.error('Failed to activate existing contact link:', error);
      showNotification?.(
        'Unable to add link',
        'We could not add the existing link to this section.',
        'error'
      );
    }
  };

  const handleAddNewLink = useCallback(() => {
    if (!languages.length) {
      showNotification?.(
        'Languages unavailable',
        'Languages are still loading. Please wait and try again.',
        'warning'
      );
      return;
    }

    if (!categories.length) {
      showNotification?.(
        'No link categories',
        'Please create link categories in the admin before adding a new link.',
        'warning'
      );
      return;
    }

    const fallbackLanguage = defaultLanguage || languages[0];
    if (!fallbackLanguage) {
      showNotification?.(
        'Languages unavailable',
        'Please enable at least one language before adding links.',
        'warning'
      );
      return;
    }

    const nextCounter = newLinkCounter + 1;
    setNewLinkCounter(nextCounter);

    const defaultCategory = categories[0]?.id || '';
    const defaultIcon =
      categories.find((category) => category.id === defaultCategory)?.icon_name || fallbackIconName;
    const initialText = buildTextEntry(fallbackLanguage);

    const newForm = {
      id: `new-${nextCounter}`,
      isNew: true,
      url: '',
      is_route: false,
      category_id: defaultCategory,
      order: activeForms.length,
      icon_name: defaultIcon,
      texts: initialText ? [initialText] : [],
      isSaving: false,
      error: null
    };

    setActiveForms((prev) => [...prev, newForm]);
  }, [languages, categories, showNotification, newLinkCounter, canEdit, defaultLanguage]);

  useImperativeHandle(ref, () => ({
    addNewLink: handleAddNewLink
  }), [handleAddNewLink]);

  const getCategoryIcon = useCallback(
    (categoryId, iconNameOverride) => {
      if (iconNameOverride) {
        return getIconComponent(iconNameOverride);
      }
      const category = categories.find((c) => c.id === categoryId);
      return getIconComponent(category?.icon_name);
    },
    [categories]
  );

  const savingOrLoading = isMetaLoading || orderSaving;

  const activeInstructions = useMemo(() => {
    if (!activeForms.length) {
      return 'No links are currently displayed in this section. Add a link to get started.';
    }
    return 'Drag to reorder links. Update details and click Save to publish changes.';
  }, [activeForms.length]);

  return (
    <div className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-white">Manage Contact Links</h4>
          <p className="text-sm text-white/60">{activeInstructions}</p>
        </div>
        <button
          type="button"
          onClick={handleAddNewLink}
          className="inline-flex items-center gap-2 rounded-lg border border-[#14C800]/40 bg-[#14C800]/10 px-4 py-2 text-sm font-medium text-[#14C800] transition hover:bg-[#14C800]/20 disabled:opacity-50"
          disabled={isMetaLoading}
        >
          <FaPlus className="h-4 w-4" />
          Add New Link
        </button>
      </div>

      {savingOrLoading && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
          <div className="h-3 w-3 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
          {isMetaLoading ? 'Loading languages and categories…' : 'Saving order…'}
        </div>
      )}

      {!isMetaLoading && !languages.length && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          <FaCircleExclamation />
          Unable to load languages. Editing is disabled.
        </div>
      )}

      <div className="mt-6">
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="contact-links">
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`space-y-4 rounded-xl border border-dashed border-white/10 p-4 transition ${
                  snapshot.isDraggingOver ? 'bg-[#14C800]/5' : 'bg-white/5'
                }`}
              >
                {activeForms.length === 0 && (
                  <div className="rounded-lg border border-white/10 bg-black/30 p-6 text-center text-sm text-white/60">
                    No active links. Add a new or existing link to show it here.
                  </div>
                )}

                {activeForms.map((form, index) => {
                  const category = categories.find((cat) => cat.id === form.category_id);
                  const iconValue = form.icon_name || category?.icon_name || fallbackIconName;
                  const Icon = getCategoryIcon(form.category_id, iconValue);
                  const iconLabel = getIconDisplayName(iconValue);
                  const firstLanguage = form.texts.find((text) => text.name?.trim());
                  const availableLanguagesForForm = languages.filter(
                    (lang) => !form.texts.some((text) => text.language_id === lang.id)
                  );
                  const iconChoices = iconOptions.some((option) => option.value === iconValue)
                    ? iconOptions
                    : [
                        ...iconOptions,
                        {
                          value: iconValue,
                          label: iconLabel,
                          Icon: getIconComponent(iconValue)
                        }
                      ];
                  return (
                    <Draggable
                      key={form.id}
                      draggableId={String(form.id)}
                      index={index}
                      isDragDisabled={form.isNew}
                    >
                      {(dragProvided, dragSnapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`rounded-xl border border-white/10 bg-black/40 p-4 transition ${
                            dragSnapshot.isDragging ? 'ring-2 ring-[#14C800]/60' : ''
                          }`}
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <button
                                type="button"
                                {...dragProvided.dragHandleProps}
                                className="rounded-lg border border-white/10 bg-white/10 p-2 text-white/60 hover:text-white disabled:cursor-not-allowed"
                                disabled={form.isNew}
                                title={form.isNew ? 'Save before reordering' : 'Drag to reorder'}
                              >
                                <FaGripVertical />
                              </button>
                              <div className="flex items-center gap-3">
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-lg text-white">
                                  <Icon />
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-white">
                                    {firstLanguage?.name || form.url || 'New Link'}
                                  </p>
                                  <p className="text-xs text-white/50">Order #{index + 1}</p>
                                </div>
                              </div>
                            </div>
                            {form.isSaving && (
                              <span className="inline-flex items-center gap-2 rounded-full border border-[#14C800]/40 bg-[#14C800]/10 px-3 py-1 text-xs font-medium text-[#14C800]">
                                <div className="h-2 w-2 animate-spin rounded-full border border-[#14C800] border-t-transparent" />
                                Saving…
                              </span>
                            )}
                          </div>

                          {form.error && (
                            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                              <FaCircleExclamation />
                              {form.error}
                            </div>
                          )}

                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="col-span-2">
                              <label className="block text-xs uppercase tracking-wide text-white/60">
                                Link URL / Route Path
                              </label>
                              <input
                                type={form.is_route ? "text" : "url"}
                                value={form.url}
                                onChange={(event) =>
                                  updateFormField(form.id, 'url', event.target.value)
                                }
                                placeholder={form.is_route ? "/contact or /en/projects" : "https://example.com/your-profile"}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#14C800]"
                              />
                              <div className="mt-2 flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`is-route-${form.id}`}
                                  checked={form.is_route}
                                  onChange={(event) =>
                                    updateFormField(form.id, 'is_route', event.target.checked)
                                  }
                                  className="h-4 w-4 rounded border-white/10 bg-black/30 text-[#14C800] focus:ring-2 focus:ring-[#14C800] focus:ring-offset-0"
                                />
                                <label htmlFor={`is-route-${form.id}`} className="text-xs text-white/70">
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
                                onChange={(event) => handleCategoryChange(form.id, event.target.value)}
                                className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#14C800]"
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
                                  onChange={(event) => handleIconChange(form.id, event.target.value)}
                                  className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#14C800]"
                                >
                                  {iconChoices.map((option) => (
                                    <option key={option.value} value={option.value}>
                                      {option.label}
                                    </option>
                                  ))}
                                </select>
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/10 text-lg text-white">
                                  <Icon />
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-white/50">
                                Showing {iconLabel} icon
                              </p>
                            </div>
                          </div>

                          <div className="mt-6 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-xs uppercase tracking-wide text-white/60">
                                Link Names
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddLanguage(form.id)}
                                className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-1 text-xs font-medium text-white transition hover:border-white/20 hover:bg-white/15 disabled:opacity-40"
                                disabled={availableLanguagesForForm.length === 0}
                              >
                                <FaPlus className="h-3 w-3" />
                                Add language
                              </button>
                            </div>
                            <div className="grid gap-3 md:grid-cols-2">
                              {form.texts.map((text, textIndex) => {
                                const languageOptions = languages.filter(
                                  (lang) =>
                                    lang.id === text.language_id ||
                                    !form.texts.some((entry) => entry.language_id === lang.id)
                                );
                                const languageMeta = languageMap.get(text.language_id);
                                return (
                                  <div
                                    key={`${form.id}-${text.language_id}-${textIndex}`}
                                    className="rounded-lg border border-white/10 bg-black/30 p-3"
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <label className="text-xs uppercase tracking-wide text-white/60">
                                        Language
                                      </label>
                                      {form.texts.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => handleRemoveLanguage(form.id, text.language_id)}
                                          className="text-xs font-medium text-red-300 transition hover:text-red-100"
                                        >
                                          Remove
                                        </button>
                                      )}
                                    </div>
                                    <select
                                      value={text.language_id}
                                      onChange={(event) =>
                                        handleTextLanguageChange(
                                          form.id,
                                          text.language_id,
                                          event.target.value
                                        )
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
                                        updateTextField(form.id, text.language_id, event.target.value)
                                      }
                                      placeholder={`Display name (${languageMeta?.code?.toUpperCase() || 'LANG'})`}
                                      className="mt-1 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none transition focus:border-[#14C800]"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-2 text-xs text-white/40">
                              <FaCircleCheck className={form.isNew ? 'text-white/30' : 'text-[#14C800]'} />
                              {form.isNew
                                ? 'Save this link to publish it.'
                                : 'This link is live on the contact page.'}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => handleDeactivateLink(form.id)}
                                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-white/70 transition hover:border-white/20 hover:bg-white/10"
                                disabled={form.isSaving}
                              >
                                {form.isNew ? 'Discard' : 'Remove from section'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveLink(form.id)}
                                className="rounded-lg border border-[#14C800]/50 bg-[#14C800]/20 px-4 py-2 text-xs font-medium text-[#14C800] transition hover:bg-[#14C800]/30 disabled:opacity-50"
                                disabled={form.isSaving || !form.url.trim() || !form.category_id}
                              >
                                {form.isSaving ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  );
                })}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      </div>

      <div className="mt-8 rounded-2xl border border-white/10 bg-black/40 p-5">
        <h5 className="text-sm font-semibold text-white">Links not shown on this page</h5>
        <p className="mt-1 text-xs text-white/50">
          Activate a saved link to include it in the Connect With Me section.
        </p>

        {inactiveLinks.length === 0 ? (
          <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4 text-xs text-white/60">
            All portfolio links are currently displayed.
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {inactiveLinks.map((link) => {
              const Icon = getIconComponent(link.category?.icon_name);
              const linkName =
                (link.texts || link.link_texts || []).find((text) => text.language_id === languages[0]?.id)?.name ||
                link.category?.texts?.[0]?.name ||
                link.url;

              return (
                <div
                  key={link.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/10 text-base text-white">
                      <Icon />
                    </span>
                    <div>
                      <p className="text-sm font-medium text-white">{linkName || 'Untitled link'}</p>
                      <p className="text-xs text-white/50">{link.url}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleActivateExisting(link)}
                    className="rounded-lg border border-[#14C800]/50 bg-[#14C800]/10 px-4 py-2 text-xs font-medium text-[#14C800] transition hover:bg-[#14C800]/20"
                  >
                    Add to section
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});

ContactLinksEditor.displayName = 'ContactLinksEditor';

export default ContactLinksEditor;
