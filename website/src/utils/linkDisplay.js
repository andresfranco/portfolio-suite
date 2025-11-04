import { getIconComponent } from './iconUtils';

const LANGUAGE_CODE_TO_ID = {
  en: 1,
  es: 2
};

const isMatchingLanguage = (text, languageCode) => {
  if (!text || !languageCode) {
    return false;
  }

  if (typeof text.language_code === 'string') {
    return text.language_code.toLowerCase() === languageCode.toLowerCase();
  }

  if (text.language?.code) {
    return text.language.code.toLowerCase() === languageCode.toLowerCase();
  }

  const targetId = LANGUAGE_CODE_TO_ID[languageCode.toLowerCase()];
  if (targetId != null && text.language_id === targetId) {
    return true;
  }

  return false;
};

const extractDefaultName = (link) => {
  return (
    link?.category?.texts?.find((text) => text?.name)?.name ||
    link?.category?.name ||
    link?.category?.code ||
    link?.url ||
    'Link'
  );
};

export const getLinkDisplayName = (link, languageCode) => {
  if (!link) {
    return 'Link';
  }

  const texts = Array.isArray(link?.texts)
    ? link.texts
    : Array.isArray(link?.link_texts)
    ? link.link_texts
    : [];

  if (texts.length === 0) {
    return extractDefaultName(link);
  }

  const preferred = texts.find(
    (text) => text?.name?.trim() && isMatchingLanguage(text, languageCode)
  );

  if (preferred) {
    return preferred.name.trim();
  }

  const fallback = texts.find((text) => text?.name?.trim());
  if (fallback) {
    return fallback.name.trim();
  }

  return extractDefaultName(link);
};

export const sortLinksByOrder = (links = []) => {
  return [...links].sort((a, b) => {
    const orderA = a?.order ?? a?.display_order ?? 0;
    const orderB = b?.order ?? b?.display_order ?? 0;
    return orderA - orderB;
  });
};

export const mapLinkToSocial = (link, languageCode) => {
  if (!link) {
    return null;
  }

  const label = getLinkDisplayName(link, languageCode);
  const iconName = link?.category?.icon_name;
  const Icon = getIconComponent(iconName);

  return {
    icon: Icon,
    href: link.url,
    label,
    ariaLabel: label,
    categoryName: link?.category?.texts?.find((text) => text?.name)?.name || label
  };
};

export const buildSocialLinks = (links = [], languageCode) => {
  return sortLinksByOrder(
    links.filter((link) => link?.is_active)
  )
    .map((link) => mapLinkToSocial(link, languageCode))
    .filter(Boolean);
};
